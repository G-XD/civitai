import { Prisma } from '@prisma/client';
import { ImageIngestionStatus } from '~/shared/utils/prisma/enums';
import { chunk } from 'lodash-es';
import { isProd } from '~/env/other';
import { env } from '~/env/server';
import { BlockedReason } from '~/server/common/enums';
import { dbRead, dbWrite } from '~/server/db/client';
import { createJob } from '~/server/jobs/job';
import type { IngestImageInput } from '~/server/schema/image.schema';
import { deleteImageById, ingestImage, ingestImageBulk } from '~/server/services/image.service';
import { limitConcurrency } from '~/server/utils/concurrency-helpers';
import { decreaseDate } from '~/utils/date-helpers';
import { getExplainSql } from '~/server/db/db-helpers';

const IMAGE_SCANNING_ERROR_DELAY = 60 * 1; // 1 hour
const IMAGE_SCANNING_RETRY_LIMIT = 3;
const rescanInterval = `${env.IMAGE_SCANNING_RETRY_DELAY} minutes`;
const errorInterval = `${IMAGE_SCANNING_ERROR_DELAY} minutes`;

export const ingestImages = createJob('ingest-images', '0 * * * *', async () => {
  const images = await dbWrite.$queryRaw<IngestImageInput[]>`
    SELECT id, url, type, width, height, meta->>'prompt' as prompt
    FROM "Image"
    WHERE (
        ingestion = ${ImageIngestionStatus.Pending}::"ImageIngestionStatus"
        AND ("scanRequestedAt" IS NULL OR "scanRequestedAt" <= now() - ${rescanInterval}::interval)
      ) OR (
        ingestion = ${ImageIngestionStatus.Error}::"ImageIngestionStatus"
        AND "scanRequestedAt" <= now() - ${errorInterval}::interval
        AND ("scanJobs"->>'retryCount')::int < ${IMAGE_SCANNING_RETRY_LIMIT}
      )
  `;

  if (!isProd) {
    console.log(images.length);
    return;
  }

  await sendImagesForScanBulk(images);
});

async function sendImagesForScanSingle(images: IngestImageInput[]) {
  const failedSends: number[] = [];
  const tasks = images.map((image, i) => async () => {
    console.log('Ingesting image', i + 1, 'of', tasks.length);
    const start = Date.now();

    let retryCount = 0,
      success = false;
    while (retryCount < 3) {
      success = await ingestImage({ image });
      if (success) break;
      console.log('Retrying image', i + 1, 'retry', retryCount + 1);
      retryCount++;
    }
    if (!success) failedSends.push(image.id);
    console.log('Image', i + 1, 'ingested in', ((Date.now() - start) / 1000).toFixed(0), 's');
  });
  await limitConcurrency(tasks, 50);
  console.log('Failed sends:', failedSends.length);
}

async function sendImagesForScanBulk(images: IngestImageInput[]) {
  const failedSends: number[] = [];
  const tasks = chunk(images, 250).map((batch, i) => async () => {
    console.log('Ingesting batch', i + 1, 'of', tasks.length);
    const start = Date.now();

    let retryCount = 0,
      success = false;
    while (retryCount < 3) {
      success = await ingestImageBulk({ images: batch });
      if (success) break;
      console.log('Retrying batch', i + 1, 'retry', retryCount + 1);
      retryCount++;
    }
    if (!success) failedSends.push(...batch.map((x) => x.id));
    console.log('Image', i + 1, 'ingested in', ((Date.now() - start) / 1000).toFixed(0), 's');
  });
  await limitConcurrency(tasks, 4);
  console.log('Failed sends:', failedSends.length);
}

// const delayedBlockCutoff = new Date('2025-05-31');
const limit = 1000;
export const removeBlockedImages = createJob('remove-blocked-images', '0 23 * * *', async () => {
  // During the delayed block period, we want to keep the images for 30 days
  // if (!isProd || delayedBlockCutoff > new Date()) return;
  const cutoff = decreaseDate(new Date(), 7, 'days');

  let nextCursor: number | undefined;
  await removeBlockedImagesRecursive(cutoff, nextCursor);
});

async function removeBlockedImagesRecursive(cutoff: Date, nextCursor?: number) {
  const images = await dbRead.$queryRaw<{ id: number }[]>`
    select id, ingestion, "blockedFor"
    from "Image"
    WHERE "ingestion" = 'Blocked' AND "blockedFor" != 'AiNotVerified'
    AND (
      ("blockedFor" != 'moderated' and "createdAt" <= ${cutoff}) OR
      ("blockedFor" = 'moderated' and "updatedAt" <= ${cutoff})
    )
    ${Prisma.raw(nextCursor ? `AND id > ${nextCursor}` : ``)}
    ORDER BY id
    LIMIT ${limit + 1}
  `;

  if (images.length > limit) {
    const nextItem = images.pop();
    nextCursor = nextItem?.id;
  } else nextCursor = undefined;

  if (!isProd) {
    console.log({ nextCursor, images: images.length });
  }

  if (!images.length) return;
  if (isProd) {
    const tasks = images.map((x) => async () => {
      await deleteImageById(x);
    });
    await limitConcurrency(tasks, 5);
  }

  if (nextCursor) {
    await removeBlockedImagesRecursive(cutoff, nextCursor);
  }
}
