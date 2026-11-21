import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Circle, Clock, CheckCircle2, Plus } from 'lucide-react';
import { Issue, IssuePermissions, IssueStatus } from '../../types/issue';
import { KanbanCard } from './KanbanCard';

export interface KanbanColumnMeta {
  status: IssueStatus;
  title: string;
  emptyMessage: string;
}

export const KANBAN_COLUMNS: KanbanColumnMeta[] = [
  {
    status: 'TODO',
    title: 'To Do',
    emptyMessage: 'No queued issues',
  },
  {
    status: 'IN_PROGRESS',
    title: 'In Progress',
    emptyMessage: 'Nothing in progress',
  },
  {
    status: 'DONE',
    title: 'Done',
    emptyMessage: 'No completed issues',
  },
];

const COLUMN_ICONS: Record<IssueStatus, React.ReactNode> = {
  TODO: <Circle className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />,
  IN_PROGRESS: <Clock className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />,
  DONE: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />,
};

interface KanbanColumnProps {
  column: KanbanColumnMeta;
  issues: Issue[];
  isLoading: boolean;
  canCreate: boolean;
  canDragForIssue: (issue: Issue) => boolean;
  pendingIssueIds: Set<string>;
  showProjectBadge?: boolean;
  className?: string;
  onAddIssue?: (status: IssueStatus) => void;
  onOpenIssue: (issue: Issue) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  issues,
  isLoading,
  canCreate,
  canDragForIssue,
  pendingIssueIds,
  showProjectBadge = false,
  className = 'flex',
  onAddIssue,
  onOpenIssue,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: {
      type: 'column',
      status: column.status,
    },
  });

  const canAnyDrag = issues.some((issue) => canDragForIssue(issue));

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.title} column`}
      data-testid={`kanban-column-${column.status}`}
      data-status={column.status}
      className={`${className} rounded-xl border flex-col min-h-[380px] lg:min-h-[520px] lg:max-h-[calc(100vh-19rem)] transition-colors ${
        isOver
          ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/15'
          : 'bg-slate-100/70 border-slate-200'
      }`}
    >
      {/* Column Header */}
      <header className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0 bg-white/70 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          {COLUMN_ICONS[column.status]}
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {column.title}
          </h2>
          <span
            data-testid={`column-count-${column.status}`}
            className="font-mono text-xs font-medium text-slate-500 tabular-nums"
          >
            {issues.length}
          </span>
        </div>

        {canCreate && onAddIssue && (
          <button
            type="button"
            onClick={() => onAddIssue(column.status)}
            aria-label={`Add issue to ${column.title}`}
            title={`Create issue in ${column.title}`}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </header>

      {/* Scrollable Card Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading ? (
          <>
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                data-testid={`column-skeleton-${column.status}`}
                className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-16 bg-slate-200 rounded" />
                  <div className="h-4 w-4 bg-slate-100 rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-5/6 bg-slate-200 rounded" />
                  <div className="h-4 w-2/3 bg-slate-100 rounded" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                  <div className="h-3.5 w-12 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </>
        ) : issues.length === 0 ? (
          <div
            className={`h-full min-h-[180px] rounded-lg border border-dashed flex flex-col items-center justify-center text-center p-5 transition-colors ${
              isOver
                ? 'border-blue-400 bg-blue-50/40 text-blue-700'
                : 'border-slate-300/80 bg-white/50 text-slate-500'
            }`}
          >
            <p className="text-xs font-medium text-slate-700">
              {isOver ? `Drop to move to ${column.title}` : column.emptyMessage}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              {canAnyDrag || !isOver
                ? 'Drag an issue card here to update its status.'
                : 'Move an existing card into this column.'}
            </p>
            {canCreate && onAddIssue && (
              <button
                type="button"
                onClick={() => onAddIssue(column.status)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create issue</span>
              </button>
            )}
          </div>
        ) : (
          issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              canDrag={canDragForIssue(issue)}
              isUpdating={pendingIssueIds.has(issue.id)}
              showProjectBadge={showProjectBadge}
              onOpenIssue={onOpenIssue}
            />
          ))
        )}
      </div>
    </section>
  );
};

export const getPermissionsCanUpdateStatus = (
  issue: Issue,
  projectPermissionsMap: Map<string, IssuePermissions>,
  fallbackPermissions?: IssuePermissions
): boolean => {
  const perms = projectPermissionsMap.get(issue.projectId) || fallbackPermissions;
  return Boolean(perms?.canUpdateStatus);
};
