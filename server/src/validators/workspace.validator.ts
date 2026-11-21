import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(60, 'Workspace name cannot exceed 60 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(60, 'Slug cannot exceed 60 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  description: z
    .string()
    .trim()
    .max(300, 'Description cannot exceed 300 characters')
    .optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(60, 'Workspace name cannot exceed 60 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(300, 'Description cannot exceed 300 characters')
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'] as const),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
