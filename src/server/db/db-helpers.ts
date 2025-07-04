import { Prisma } from '@prisma/client';
import type { QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';
import { env } from '~/env/server';
import { dbWrite } from '~/server/db/client';
import { limitConcurrency } from '~/server/utils/concurrency-helpers';
import { createLogger } from '~/utils/logging';

const log = createLogger('pgDb', 'blue');

type CancellableResult<R extends QueryResultRow = any> = {
  query: Promise<QueryResult<R>>;
  result: () => Promise<R[]>;
  cancel: () => Promise<void>;
};
export type AugmentedPool = Pool & {
  cancellableQuery: <R extends QueryResultRow = any>(
    sql: Prisma.Sql | string
  ) => Promise<CancellableResult<R>>;
};

type ClientInstanceType =
  | 'primary'
  | 'primaryRead'
  | 'primaryReadLong'
  | 'notification'
  | 'notificationRead';
const instanceUrlMap: Record<ClientInstanceType, string> = {
  notification: env.NOTIFICATION_DB_URL,
  notificationRead: env.NOTIFICATION_DB_REPLICA_URL ?? env.NOTIFICATION_DB_URL,
  primary: env.DATABASE_URL,
  primaryRead: env.DATABASE_REPLICA_URL ?? env.DATABASE_URL,
  primaryReadLong: env.DATABASE_REPLICA_LONG_URL ?? env.DATABASE_URL,
};

export function getClient(
  { instance }: { instance: ClientInstanceType } = {
    instance: 'primary',
  }
) {
  log(`Creating ${instance} client`);

  const envUrl = instanceUrlMap[instance];
  const connectionStringUrl = new URL(envUrl);
  if (env.DATABASE_SSL !== false) connectionStringUrl.searchParams.set('sslmode', 'no-verify');
  const connectionString = connectionStringUrl.toString();

  const isNotification = instance === 'notification' || instance === 'notificationRead';
  const appBaseName = isNotification ? 'notif-pg' : 'node-pg';

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT,
    min: 0,
    max: env.DATABASE_POOL_MAX,
    // trying this for leaderboard job
    idleTimeoutMillis: instance === 'primaryReadLong' ? 300_000 : env.DATABASE_POOL_IDLE_TIMEOUT,
    statement_timeout:
      instance === 'notificationRead'
        ? undefined // standby seems to not support this
        : instance === 'primaryRead'
        ? env.DATABASE_READ_TIMEOUT
        : env.DATABASE_WRITE_TIMEOUT,
    application_name: `${appBaseName}${env.PODNAME ? '-' + env.PODNAME : ''}`,
  }) as AugmentedPool;

  pool.cancellableQuery = async function <R extends QueryResultRow = any>(
    sql: Prisma.Sql | string
  ) {
    const connection = await pool.connect();
    const pidQuery = await connection.query('SELECT pg_backend_pid()');
    const pid = pidQuery.rows[0].pg_backend_pid;

    // Fix dates
    if (typeof sql === 'object') {
      for (const i in sql.values) sql.values[i] = formatSqlType(sql.values[i]);
    }

    // Logging
    log(instance, sql);

    let done = false;
    const query = connection.query<R>(sql);
    query.finally(() => {
      done = true;
      connection.release();
    });

    const cancel = async () => {
      if (done) return;
      const cancelConnection = await pool.connect();
      await cancelConnection.query('SELECT pg_cancel_backend($1)', [pid]);
      cancelConnection.release();
      done = true;
    };
    const result = async () => {
      const { rows } = await query;
      return rows;
    };

    return { query, result, cancel };
  };

  return pool;
}

function formatSqlType(value: any): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(formatSqlType).join(',');
    }
    if (value === null) return 'null';
    return JSON.stringify(value);
  }
  return value;
}

export function templateHandler<T>(fn: (value: string) => Promise<T> | T) {
  return function (sql: TemplateStringsArray, ...values: any[]) {
    const sqlString = sql.reduce((acc, part, i) => acc + part + formatSqlType(values[i] ?? ''), '');
    return fn(sqlString);
  };
}

function lsnGTE(lsn1: string, lsn2: string): boolean {
  const [a1, b1] = lsn1.split('/').map((part) => parseInt(part, 16));
  const [a2, b2] = lsn2.split('/').map((part) => parseInt(part, 16));
  return a1 > a2 || (a1 === a2 && b1 >= b2);
}

export async function getCurrentLSN() {
  try {
    const currentRes = await dbWrite.$queryRaw<
      {
        lsn: string;
      }[]
    >`SELECT pg_current_wal_lsn()::text AS lsn`;
    return currentRes[0]?.lsn ?? '';
  } catch (e) {
    // TODO what to return here
    return '';
  }
}

export async function checkNotUpToDate(lsn: string) {
  try {
    const roRes = await dbWrite.$queryRaw<
      { replay_lsn: string }[]
    >`SELECT replay_lsn::text FROM get_replication_status() where application_name like 'ro-c16-%'`;
    return roRes.some((row) => !lsnGTE(row.replay_lsn, lsn));
  } catch (e) {
    return true;
  }
}

export type RunContext = {
  cancelFns: (() => Promise<void>)[];
  batchSize: number;
  concurrency: number;
  start: number;
  end?: number;
  after?: Date;
  before?: Date;
};

type DataProcessorOptions = {
  rangeFetcher: (context: RunContext) => Promise<{ start: number; end: number }>;
  processor: (context: Omit<RunContext, 'end'> & { end: number }) => Promise<void>;
  enableLogging?: boolean;
  runContext: {
    on: (event: 'close', listener: () => void) => void;
  };
  params: {
    batchSize: number;
    concurrency: number;
    start: number;
    end?: number;
    after?: Date;
    before?: Date;
  };
};

export async function dataProcessor({
  rangeFetcher,
  processor,
  runContext,
  params,
}: DataProcessorOptions) {
  const cancelFns: (() => Promise<void>)[] = [];
  let stop = false;
  runContext.on('close', async () => {
    console.log('Cancelling');
    stop = true;
    await Promise.all(cancelFns.map((cancel) => cancel()));
  });

  const { start = 1, end, batchSize, concurrency } = params;
  const context = { ...params, cancelFns };

  if (stop) return;
  const range =
    start === undefined || end === undefined ? await rangeFetcher(context) : { start, end };

  let cursor = range.start ?? params.start;
  const maxCursor = range.end;
  await limitConcurrency(() => {
    if (stop || cursor > maxCursor) return null;
    const start = cursor;
    cursor = Math.min(cursor + batchSize, maxCursor);
    const end = cursor;
    cursor++; // To avoid batch overlap

    return async () => {
      try {
        await processor({ ...context, start, end });
      } catch (e) {
        console.log({ start, end, message: (e as Error).message });
      }
    };
  }, concurrency);
}

export type BatchRunContext = {
  cancelFns: (() => Promise<void>)[];
  batchSize: number;
  concurrency: number;
};
type BatchProcessorOptions = {
  batchFetcher: (context: BatchRunContext) => Promise<number[]>;
  processor: (
    context: BatchRunContext & { batch: number[]; batchNumber: number; batchCount: number }
  ) => Promise<void>;
  enableLogging?: boolean;
  runContext: {
    on: (event: 'close', listener: () => void) => void;
  };
  params: {
    batchSize: number;
    concurrency: number;
    ids?: number[];
    start?: number;
    end?: number;
  };
};

export async function batchProcessor({
  batchFetcher,
  processor,
  runContext,
  params,
}: BatchProcessorOptions) {
  const cancelFns: (() => Promise<void>)[] = [];
  let stop = false;
  runContext.on('close', async () => {
    console.log('Cancelling');
    stop = true;
    await Promise.all(cancelFns.map((cancel) => cancel()));
  });

  const { batchSize, concurrency } = params;
  let { ids } = params;
  if (stop) return;
  const context = { ...params, cancelFns };
  ids ??= await batchFetcher(context);

  let cursor = params.start ?? 0;
  const batchCount = params.end ?? Math.ceil(ids.length / batchSize);
  await limitConcurrency(() => {
    if (stop || cursor >= batchCount) return null;
    const start = cursor;
    cursor++;
    const end = cursor;

    const batch = ids.slice(start * batchSize, end * batchSize);
    const batchNumber = cursor;
    return async () => {
      await processor({ ...context, batch, batchNumber, batchCount });
    };
  }, concurrency);
}

export function combineSqlWithParams(sql: string, params: readonly unknown[]) {
  let query = sql;
  const parameters = params as string[];
  for (let i = 0; i < parameters.length; i++) {
    // Negative lookahead for no more numbers, ie. replace $1 in '$1' but not '$11'
    const re = new RegExp('([$:])' + (i + 1) + '(?!\\d)', 'g');
    // If string, will quote - if bool or numeric, will not - does the job here
    if (typeof parameters[i] === 'string')
      parameters[i] = "'" + parameters[i].replace("'", "\\'") + "'";
    //params[i] = JSON.stringify(params[i])
    query = query.replace(re, parameters[i]);
  }
  return query;
}

export function getExplainSql(value: typeof Prisma.Sql) {
  const obj = Prisma.sql`
    EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON)
    ${value}
  `;
  return combineSqlWithParams(obj.text, obj.values);
}

export const dbKV = {
  get: async function <T>(key: string, defaultValue?: T) {
    const stored = await dbWrite.keyValue.findUnique({ where: { key } });
    return stored ? (stored.value as T) : defaultValue;
  },
  set: async function <T>(key: string, value: T) {
    const json = JSON.stringify(value);
    await dbWrite.$executeRawUnsafe(`
      INSERT INTO "KeyValue" ("key", "value")
      VALUES ('${key}', '${json}'::jsonb)
      ON CONFLICT ("key")
      DO UPDATE SET "value" = '${json}'::jsonb
    `);
  },
};
