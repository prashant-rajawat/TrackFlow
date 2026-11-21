import { z } from 'zod';

export const ISSUE_TYPES = ['BUG', 'FEATURE', 'TASK'] as const;
export const ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

const dueDateField = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      return !Number.isNaN(Date.parse(val));
    },
    { message: 'Please provide a valid due date' }
  );

const assigneeIdField = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => (val === '' ? null : val));

export const createIssueSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Issue title must be at least 3 characters')
    .max(120, 'Issue title cannot exceed 120 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Issue description is required')
    .max(10000, 'Issue description cannot exceed 10,000 characters'),
  type: z.enum(ISSUE_TYPES).default('BUG'),
  priority: z.enum(ISSUE_PRIORITIES).default('MEDIUM'),
  status: z.enum(ISSUE_STATUSES).default('TODO'),
  assigneeId: assigneeIdField,
  dueDate: dueDateField,
});

export const updateIssueSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Issue title must be at least 3 characters')
      .max(120, 'Issue title cannot exceed 120 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, 'Issue description is required')
      .max(10000, 'Issue description cannot exceed 10,000 characters')
      .optional(),
    type: z.enum(ISSUE_TYPES).optional(),
    priority: z.enum(ISSUE_PRIORITIES).optional(),
    status: z.enum(ISSUE_STATUSES).optional(),
    assigneeId: assigneeIdField,
    dueDate: dueDateField,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one updatable field is required',
  });

export const updateIssueAssigneeSchema = z.object({
  assigneeId: z
    .string()
    .trim()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

export const updateIssuePrioritySchema = z.object({
  priority: z.enum(ISSUE_PRIORITIES),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
