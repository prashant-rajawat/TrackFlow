import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 2000;

export const createCommentSchema = z.object({
  content: z
    .string({ error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`),
});

export const createReplySchema = z.object({
  content: z
    .string({ error: 'Reply content is required' })
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(MAX_COMMENT_LENGTH, `Reply cannot exceed ${MAX_COMMENT_LENGTH} characters`),
  issueId: z.string().trim().optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string({ error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`),
});

export const listCommentsQuerySchema = z.object({
  sort: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateReplyInput = z.infer<typeof createReplySchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
