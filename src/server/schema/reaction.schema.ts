import { ReviewReactions } from '~/shared/utils/prisma/enums';
import * as z from 'zod/v4';

export const reactableEntities: readonly [string, ...string[]] = [
  'question',
  'answer',
  'comment',
  'commentOld',
  'image',
  'post',
  'resourceReview',
  'article',
  'bountyEntry',
  'clubPost',
];

export type ReactionEntityType = ToggleReactionInput['entityType'];
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
export const toggleReactionSchema = z.object({
  entityId: z.number(),
  entityType: z.enum(reactableEntities),
  reaction: z.nativeEnum(ReviewReactions),
});
