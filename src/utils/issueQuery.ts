import {
  CreatedDatePreset,
  DueDatePreset,
  IssuePagination,
  IssuePriority,
  IssueQueryParams,
  IssueQueryState,
  IssueSortField,
  IssueStatus,
  IssueType,
  IssueUserSummary,
  ProjectWithIssuePermissions,
  SortOrder,
} from '../types/issue';

export const VALID_ISSUE_STATUSES: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
export const VALID_ISSUE_PRIORITIES: IssuePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const VALID_ISSUE_TYPES: IssueType[] = ['BUG', 'FEATURE', 'TASK'];
export const VALID_DUE_DATE_PRESETS: DueDatePreset[] = [
  'overdue',
  'due_today',
  'next_7_days',
  'next_30_days',
  'no_due_date',
];
export const VALID_SORT_FIELDS: IssueSortField[] = [
  'updatedAt',
  'createdAt',
  'dueDate',
  'priority',
  'status',
  'issueKey',
  'title',
];
export const VALID_SORT_ORDERS: SortOrder[] = ['desc', 'asc'];
export const VALID_PAGE_SIZES = [10, 20, 50, 100] as const;

export const STATUS_LABELS: Record<IssueStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const TYPE_LABELS: Record<IssueType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  TASK: 'Task',
};

export const DUE_DATE_PRESET_LABELS: Record<DueDatePreset, string> = {
  overdue: 'Overdue',
  due_today: 'Due today',
  next_7_days: 'Next 7 days',
  next_30_days: 'Next 30 days',
  no_due_date: 'No due date',
};

export const CREATED_PRESET_LABELS: Record<Exclude<CreatedDatePreset, '' | 'custom'>, string> = {
  today: 'Created today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
};

export const SORT_FIELD_LABELS: Record<IssueSortField, string> = {
  updatedAt: 'Updated Date',
  createdAt: 'Created Date',
  dueDate: 'Due Date',
  priority: 'Priority',
  status: 'Status',
  issueKey: 'Issue Key',
  title: 'Title (A–Z)',
};

export const DEFAULT_ISSUE_QUERY_STATE: IssueQueryState = {
  search: '',
  status: [],
  priority: [],
  type: [],
  assigneeId: [],
  reporterId: [],
  projectId: [],
  dueDatePreset: '',
  dueDateFrom: '',
  dueDateTo: '',
  createdPreset: '',
  createdFrom: '',
  createdTo: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  page: 1,
  limit: 20,
};

const extractTokens = (searchParams: URLSearchParams, key: string): string[] => {
  const all = searchParams.getAll(key);
  const tokens: string[] = [];
  for (const item of all) {
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed) tokens.push(trimmed);
    }
  }
  return Array.from(new Set(tokens));
};

const isValidDateString = (val: string | null): val is string => {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  return !Number.isNaN(Date.parse(trimmed));
};

const toUtcDateInput = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseSearchParamsToIssueQuery = (
  searchParams: URLSearchParams,
  options?: { allowProjectFilter?: boolean }
): IssueQueryState => {
  const allowProjectFilter = options?.allowProjectFilter ?? true;

  const status = extractTokens(searchParams, 'status').filter((v): v is IssueStatus =>
    (VALID_ISSUE_STATUSES as string[]).includes(v)
  );
  const priority = extractTokens(searchParams, 'priority').filter((v): v is IssuePriority =>
    (VALID_ISSUE_PRIORITIES as string[]).includes(v)
  );
  const type = extractTokens(searchParams, 'type').filter((v): v is IssueType =>
    (VALID_ISSUE_TYPES as string[]).includes(v)
  );
  const assigneeId = extractTokens(searchParams, 'assigneeId');
  const reporterId = extractTokens(searchParams, 'reporterId');
  const projectId = allowProjectFilter ? extractTokens(searchParams, 'projectId') : [];

  const rawDuePreset = searchParams.get('dueDatePreset')?.trim() || '';
  const dueDatePreset = (VALID_DUE_DATE_PRESETS as string[]).includes(rawDuePreset)
    ? (rawDuePreset as DueDatePreset)
    : '';

  const rawDueFrom = searchParams.get('dueDateFrom')?.trim() || '';
  const rawDueTo = searchParams.get('dueDateTo')?.trim() || '';
  const dueDateFrom = isValidDateString(rawDueFrom) ? rawDueFrom : '';
  const dueDateTo = isValidDateString(rawDueTo) ? rawDueTo : '';

  const rawCreatedPreset = searchParams.get('createdPreset')?.trim() || '';
  const rawCreatedFrom = searchParams.get('createdFrom')?.trim() || '';
  const rawCreatedTo = searchParams.get('createdTo')?.trim() || '';
  const createdFrom = isValidDateString(rawCreatedFrom) ? rawCreatedFrom : '';
  const createdTo = isValidDateString(rawCreatedTo) ? rawCreatedTo : '';

  let createdPreset: CreatedDatePreset = '';
  if (
    rawCreatedPreset === 'today' ||
    rawCreatedPreset === 'last_7_days' ||
    rawCreatedPreset === 'last_30_days' ||
    rawCreatedPreset === 'custom'
  ) {
    createdPreset = rawCreatedPreset;
  } else if (createdFrom || createdTo) {
    createdPreset = 'custom';
  }

  const rawSortBy = searchParams.get('sortBy')?.trim() || '';
  const sortBy = (VALID_SORT_FIELDS as string[]).includes(rawSortBy)
    ? (rawSortBy as IssueSortField)
    : 'updatedAt';

  const rawSortOrder = searchParams.get('sortOrder')?.trim() || '';
  const sortOrder = (VALID_SORT_ORDERS as string[]).includes(rawSortOrder)
    ? (rawSortOrder as SortOrder)
    : 'desc';

  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawLimit = Number(searchParams.get('limit'));
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 20;

  return {
    search: searchParams.get('search') || '',
    status,
    priority,
    type,
    assigneeId,
    reporterId,
    projectId,
    dueDatePreset,
    dueDateFrom,
    dueDateTo,
    createdPreset,
    createdFrom,
    createdTo,
    sortBy,
    sortOrder,
    page,
    limit,
  };
};

export const serializeIssueQueryToSearchParams = (
  state: IssueQueryState,
  options?: { allowProjectFilter?: boolean }
): URLSearchParams => {
  const params = new URLSearchParams();
  const allowProjectFilter = options?.allowProjectFilter ?? true;

  const trimmedSearch = state.search.trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  if (state.status.length > 0) params.set('status', state.status.join(','));
  if (state.priority.length > 0) params.set('priority', state.priority.join(','));
  if (state.type.length > 0) params.set('type', state.type.join(','));
  if (state.assigneeId.length > 0) params.set('assigneeId', state.assigneeId.join(','));
  if (state.reporterId.length > 0) params.set('reporterId', state.reporterId.join(','));
  if (allowProjectFilter && state.projectId.length > 0) {
    params.set('projectId', state.projectId.join(','));
  }

  if (state.dueDatePreset) params.set('dueDatePreset', state.dueDatePreset);
  if (state.dueDateFrom) params.set('dueDateFrom', state.dueDateFrom);
  if (state.dueDateTo) params.set('dueDateTo', state.dueDateTo);

  if (state.createdPreset && state.createdPreset !== 'custom') {
    params.set('createdPreset', state.createdPreset);
  } else {
    if (state.createdPreset === 'custom' && (state.createdFrom || state.createdTo)) {
      params.set('createdPreset', 'custom');
    }
    if (state.createdFrom) params.set('createdFrom', state.createdFrom);
    if (state.createdTo) params.set('createdTo', state.createdTo);
  }

  if (state.sortBy !== DEFAULT_ISSUE_QUERY_STATE.sortBy) {
    params.set('sortBy', state.sortBy);
  }
  if (state.sortOrder !== DEFAULT_ISSUE_QUERY_STATE.sortOrder) {
    params.set('sortOrder', state.sortOrder);
  }
  if (state.page !== DEFAULT_ISSUE_QUERY_STATE.page) {
    params.set('page', String(state.page));
  }
  if (state.limit !== DEFAULT_ISSUE_QUERY_STATE.limit) {
    params.set('limit', String(state.limit));
  }

  return params;
};

export const toApiIssueQueryParams = (
  state: IssueQueryState,
  options?: { allowProjectFilter?: boolean; now?: Date }
): IssueQueryParams => {
  const allowProjectFilter = options?.allowProjectFilter ?? true;
  const now = options?.now ?? new Date();

  let createdFrom = state.createdFrom || undefined;
  let createdTo = state.createdTo || undefined;

  if (state.createdPreset === 'today') {
    const todayStr = toUtcDateInput(now);
    createdFrom = todayStr;
    createdTo = todayStr;
  } else if (state.createdPreset === 'last_7_days') {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)
    );
    createdFrom = toUtcDateInput(start);
    createdTo = toUtcDateInput(now);
  } else if (state.createdPreset === 'last_30_days') {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)
    );
    createdFrom = toUtcDateInput(start);
    createdTo = toUtcDateInput(now);
  }

  const params: IssueQueryParams = {
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    page: state.page,
    limit: state.limit,
  };

  const trimmedSearch = state.search.trim();
  if (trimmedSearch) params.search = trimmedSearch;
  if (state.status.length > 0) params.status = state.status;
  if (state.priority.length > 0) params.priority = state.priority;
  if (state.type.length > 0) params.type = state.type;
  if (state.assigneeId.length > 0) params.assigneeId = state.assigneeId;
  if (state.reporterId.length > 0) params.reporterId = state.reporterId;
  if (allowProjectFilter && state.projectId.length > 0) {
    params.projectId = state.projectId;
  }
  if (state.dueDatePreset) params.dueDatePreset = state.dueDatePreset;
  if (state.dueDateFrom) params.dueDateFrom = state.dueDateFrom;
  if (state.dueDateTo) params.dueDateTo = state.dueDateTo;
  if (createdFrom) params.createdFrom = createdFrom;
  if (createdTo) params.createdTo = createdTo;

  return params;
};

export interface ActiveFilterChip {
  id: string;
  category:
    | 'search'
    | 'status'
    | 'priority'
    | 'type'
    | 'assigneeId'
    | 'reporterId'
    | 'projectId'
    | 'dueDate'
    | 'createdDate';
  value?: string;
  label: string;
}

export const buildActiveFilterChips = (
  state: IssueQueryState,
  context: {
    projects?: ProjectWithIssuePermissions[];
    members?: IssueUserSummary[];
    allowProjectFilter?: boolean;
  }
): ActiveFilterChip[] => {
  const chips: ActiveFilterChip[] = [];
  const allowProjectFilter = context.allowProjectFilter ?? true;

  if (state.search.trim()) {
    chips.push({
      id: 'search',
      category: 'search',
      label: `Search: "${state.search.trim()}"`,
    });
  }

  for (const s of state.status) {
    chips.push({
      id: `status:${s}`,
      category: 'status',
      value: s,
      label: `Status: ${STATUS_LABELS[s] || s}`,
    });
  }

  for (const p of state.priority) {
    chips.push({
      id: `priority:${p}`,
      category: 'priority',
      value: p,
      label: `Priority: ${PRIORITY_LABELS[p] || p}`,
    });
  }

  for (const t of state.type) {
    chips.push({
      id: `type:${t}`,
      category: 'type',
      value: t,
      label: `Type: ${TYPE_LABELS[t] || t}`,
    });
  }

  if (allowProjectFilter) {
    for (const pid of state.projectId) {
      const proj = context.projects?.find((p) => p.id === pid);
      chips.push({
        id: `projectId:${pid}`,
        category: 'projectId',
        value: pid,
        label: `Project: ${proj ? `${proj.key} · ${proj.name}` : pid}`,
      });
    }
  }

  for (const aid of state.assigneeId) {
    if (aid === 'UNASSIGNED') {
      chips.push({
        id: 'assigneeId:UNASSIGNED',
        category: 'assigneeId',
        value: 'UNASSIGNED',
        label: 'Assignee: Unassigned',
      });
    } else {
      const member = context.members?.find((m) => m.id === aid);
      chips.push({
        id: `assigneeId:${aid}`,
        category: 'assigneeId',
        value: aid,
        label: `Assignee: ${member ? member.fullName : aid}`,
      });
    }
  }

  for (const rid of state.reporterId) {
    const member = context.members?.find((m) => m.id === rid);
    chips.push({
      id: `reporterId:${rid}`,
      category: 'reporterId',
      value: rid,
      label: `Reporter: ${member ? member.fullName : rid}`,
    });
  }

  if (state.dueDatePreset) {
    chips.push({
      id: 'dueDate:preset',
      category: 'dueDate',
      label: `Due: ${DUE_DATE_PRESET_LABELS[state.dueDatePreset]}`,
    });
  } else if (state.dueDateFrom || state.dueDateTo) {
    chips.push({
      id: 'dueDate:range',
      category: 'dueDate',
      label: `Due: ${state.dueDateFrom || '...'} to ${state.dueDateTo || '...'}`,
    });
  }

  if (state.createdPreset && state.createdPreset !== 'custom') {
    chips.push({
      id: 'createdDate:preset',
      category: 'createdDate',
      label: CREATED_PRESET_LABELS[state.createdPreset],
    });
  } else if (state.createdFrom || state.createdTo) {
    chips.push({
      id: 'createdDate:range',
      category: 'createdDate',
      label: `Created: ${state.createdFrom || '...'} to ${state.createdTo || '...'}`,
    });
  }

  return chips;
};

export const countActiveFilters = (
  state: IssueQueryState,
  allowProjectFilter = true
): number => {
  let count = 0;
  if (state.search.trim()) count++;
  count += state.status.length;
  count += state.priority.length;
  count += state.type.length;
  count += state.assigneeId.length;
  count += state.reporterId.length;
  if (allowProjectFilter) count += state.projectId.length;
  if (state.dueDatePreset || state.dueDateFrom || state.dueDateTo) count++;
  if (
    (state.createdPreset && state.createdPreset !== 'custom') ||
    state.createdFrom ||
    state.createdTo
  ) {
    count++;
  }
  return count;
};

export const removeActiveFilterChip = (
  state: IssueQueryState,
  chip: ActiveFilterChip
): IssueQueryState => {
  const next = { ...state, page: 1 };
  switch (chip.category) {
    case 'search':
      next.search = '';
      break;
    case 'status':
      next.status = state.status.filter((v) => v !== chip.value);
      break;
    case 'priority':
      next.priority = state.priority.filter((v) => v !== chip.value);
      break;
    case 'type':
      next.type = state.type.filter((v) => v !== chip.value);
      break;
    case 'assigneeId':
      next.assigneeId = state.assigneeId.filter((v) => v !== chip.value);
      break;
    case 'reporterId':
      next.reporterId = state.reporterId.filter((v) => v !== chip.value);
      break;
    case 'projectId':
      next.projectId = state.projectId.filter((v) => v !== chip.value);
      break;
    case 'dueDate':
      next.dueDatePreset = '';
      next.dueDateFrom = '';
      next.dueDateTo = '';
      break;
    case 'createdDate':
      next.createdPreset = '';
      next.createdFrom = '';
      next.createdTo = '';
      break;
  }
  return next;
};

export const createFallbackPagination = (
  issuesCount: number,
  page = 1,
  limit = 20
): IssuePagination => {
  const totalPages = issuesCount === 0 ? 0 : Math.ceil(issuesCount / limit);
  return {
    currentPage: page,
    pageSize: limit,
    totalItems: issuesCount,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1 && issuesCount > 0,
  };
};
