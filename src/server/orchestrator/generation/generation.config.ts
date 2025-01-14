import { z } from 'zod';
import { haiperVideoGenerationConfig } from '~/server/orchestrator/haiper/haiper.schema';
import { klingVideoGenerationConfig } from '~/server/orchestrator/kling/kling.schema';
import { minimaxVideoGenerationConfig } from '~/server/orchestrator/minimax/minimax.schema';
import { mochiVideoGenerationConfig } from '~/server/orchestrator/mochi/mochi.schema';

export type VideoGenerationSchema = z.infer<(typeof videoGenerationConfig)[number]['schema']>;
export const videoGenerationConfig = [
  ...klingVideoGenerationConfig,
  ...haiperVideoGenerationConfig,
  ...mochiVideoGenerationConfig,
  ...minimaxVideoGenerationConfig,
] as const;