import { z } from 'zod';
import {
  ISSUE_TYPES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
} from './issue.validator.js';
import { isValidEntityId } from '../services/issue.rbac.service.js';

export const ISSUE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'priority',
  'status',
  'issueKey',
  'title',
] as const;

export const SORT_ORDERS = ['asc', 'desc'] as const;

export const DUE_DATE_PRESETS = [
  'overdue',
  'due_today',
  'next_7_days',
  'next_30_days',
  'no_due_date',
] as const;

export type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];
export type DueDatePreset = (typeof DUE_DATE_PRESETS)[number];

const normalizeMultiValue = (val: unknown): string[] | undefined => {
  if (val === undefined || val === null) return undefined;
  const rawList = Array.isArray(val) ? val : [val];
  const tokens: string[] = [];

  for (const item of rawList) {
    if (typeof item !== 'string') {
      tokens.push(String(item));
      continue;
    }
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        tokens.push(trimmed);
      }
    }
  }

  return tokens.length > 0 ? Array.from(new Set(tokens)) : undefined;
};

const optionalSingleString = (val: unknown): string | undefined => {
  if (val === undefined || val === null) return undefined;
  const s = Array.isArray(val) ? String(val[0] ?? '') : String(val);
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isValidDateInput = (val: string): boolean => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }
  return !Number.isNaN(Date.parse(val));
};

export const parseDateRangeStart = (val: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T00:00:00.000Z`);
  }
  return new Date(val);
};

export const parseDateRangeEnd = (val: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T23:59:59.999Z`);
  }
  return new Date(val);
};

const integerQueryParam = (fieldName: string, min: number, max?: number, defaultValue?: number) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return defaultValue;
      const raw = Array.isArray(val) ? val[0] : val;
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return defaultValue;
        if (!/^-?\d+$/.test(trimmed)) return NaN;
        return Number(trimmed);
      }
      return NaN;
    },
    z
      .number({ message: `${fieldName} must be a valid integer` })
      .int(`${fieldName} must be a whole integer`)
      .min(min, `${fieldName} must be at least ${min}`)
      .refine((n) => (max !== undefined ? n <= max : true), {
        message: `${fieldName} cannot exceed ${max}`,
      })
  );

export const issueQuerySchema = z
  .object({
    search: z.preprocess(
      optionalSingleString,
      z.string().max(200, 'Search query cannot exceed 200 characters').optional()
    ),
    status: z.preprocess(
      normalizeMultiValue,
      z.array(z.enum(ISSUE_STATUSES)).optional()
    ),
    priority: z.preprocess(
      normalizeMultiValue,
      z.array(z.enum(ISSUE_PRIORITIES)).optional()
    ),
    type: z.preprocess(
      normalizeMultiValue,
      z.array(z.enum(ISSUE_TYPES)).optional()
    ),
    assigneeId: z.preprocess(
      normalizeMultiValue,
      z
        .array(
          z.string().refine((id) => id === 'UNASSIGNED' || isValidEntityId(id, 'usr'), {
            message: 'Invalid assigneeId filter value',
          })
        )
        .optional()
    ),
    reporterId: z.preprocess(
      normalizeMultiValue,
      z
        .array(
          z.string().refine((id) => isValidEntityId(id, 'usr'), {
            message: 'Invalid reporterId filter value',
          })
        )
        .optional()
    ),
    projectId: z.preprocess(
      normalizeMultiValue,
      z
        .array(
          z.string().refine((id) => isValidEntityId(id, 'proj'), {
            message: 'Invalid projectId filter value',
          })
        )
        .optional()
    ),
    dueDatePreset: z.preprocess(
      optionalSingleString,
      z.enum(DUE_DATE_PRESETS).optional()
    ),
    dueDateFrom: z.preprocess(
      optionalSingleString,
      z
        .string()
        .refine(isValidDateInput, { message: 'Invalid dueDateFrom date format' })
        .optional()
    ),
    dueDateTo: z.preprocess(
      optionalSingleString,
      z
        .string()
        .refine(isValidDateInput, { message: 'Invalid dueDateTo date format' })
        .optional()
    ),
    createdFrom: z.preprocess(
      optionalSingleString,
      z
        .string()
        .refine(isValidDateInput, { message: 'Invalid createdFrom date format' })
        .optional()
    ),
    createdTo: z.preprocess(
      optionalSingleString,
      z
        .string()
        .refine(isValidDateInput, { message: 'Invalid createdTo date format' })
        .optional()
    ),
    sortBy: z.preprocess(
      optionalSingleString,
      z.enum(ISSUE_SORT_FIELDS).default('updatedAt')
    ),
    sortOrder: z.preprocess(
      optionalSingleString,
      z.enum(SORT_ORDERS).default('desc')
    ),
    page: integerQueryParam('page', 1, 100000, 1),
    limit: integerQueryParam('limit', 1, 100, 20),
  })
  .superRefine((data, ctx) => {
    if (data.dueDateFrom && data.dueDateTo) {
      const from = parseDateRangeStart(data.dueDateFrom);
      const to = parseDateRangeEnd(data.dueDateTo);
      if (from.getTime() > to.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dueDateFrom'],
          message: 'dueDateFrom cannot be after dueDateTo',
        });
      }
    }

    if (data.createdFrom && data.createdTo) {
      const from = parseDateRangeStart(data.createdFrom);
      const to = parseDateRangeEnd(data.createdTo);
      if (from.getTime() > to.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['createdFrom'],
          message: 'createdFrom cannot be after createdTo',
        });
      }
    }
  });

export type ParsedIssueQuery = z.infer<typeof issueQuerySchema>;

export interface AppliedIssueFilters {
  search?: string;
  status?: string[];
  priority?: string[];
  type?: string[];
  assigneeId?: string[];
  reporterId?: string[];
  projectId?: string[];
  dueDatePreset?: DueDatePreset;
  dueDateFrom?: string;
  dueDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface AppliedIssueSorting {
  sortBy: IssueSortField;
  sortOrder: SortOrder;
}

export interface IssuePaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const extractAppliedFilters = (parsed: ParsedIssueQuery): AppliedIssueFilters => {
  const filters: AppliedIssueFilters = {};
  if (parsed.search) filters.search = parsed.search;
  if (parsed.status?.length) filters.status = parsed.status;
  if (parsed.priority?.length) filters.priority = parsed.priority;
  if (parsed.type?.length) filters.type = parsed.type;
  if (parsed.assigneeId?.length) filters.assigneeId = parsed.assigneeId;
  if (parsed.reporterId?.length) filters.reporterId = parsed.reporterId;
  if (parsed.projectId?.length) filters.projectId = parsed.projectId;
  if (parsed.dueDatePreset) filters.dueDatePreset = parsed.dueDatePreset;
  if (parsed.dueDateFrom) filters.dueDateFrom = parsed.dueDateFrom;
  if (parsed.dueDateTo) filters.dueDateTo = parsed.dueDateTo;
  if (parsed.createdFrom) filters.createdFrom = parsed.createdFrom;
  if (parsed.createdTo) filters.createdTo = parsed.createdTo;
  return filters;
};
