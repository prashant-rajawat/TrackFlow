import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name cannot exceed 100 characters'),
  key: z
    .string()
    .trim()
    .min(2, 'Project key must be at least 2 characters')
    .max(10, 'Project key cannot exceed 10 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'Project key can only contain letters, numbers, hyphens, and underscores'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  leadId: z.string().optional().nullable(),
  visibility: z.enum(['PRIVATE', 'WORKSPACE'] as const).default('WORKSPACE'),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  color: z.string().optional().default('blue'),
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .max(100, 'Project name cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  leadId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED'] as const).optional(),
  visibility: z.enum(['PRIVATE', 'WORKSPACE'] as const).optional(),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  color: z.string().optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['PROJECT_ADMIN', 'DEVELOPER', 'VIEWER'] as const).default('DEVELOPER'),
});

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['PROJECT_ADMIN', 'DEVELOPER', 'VIEWER'] as const),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleSchema>;
