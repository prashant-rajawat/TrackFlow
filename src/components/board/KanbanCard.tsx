import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Calendar, Lock, Loader2 } from 'lucide-react';
import { Issue } from '../../types/issue';
import { IssueType } from '../issues/IssueType';
import { IssuePriority } from '../issues/IssuePriority';
import { IssueAssignee } from '../issues/IssueAssignee';

interface KanbanCardProps {
  issue: Issue;
  canDrag: boolean;
  isUpdating?: boolean;
  showProjectBadge?: boolean;
  onOpenIssue: (issue: Issue) => void;
}

const formatDueDate = (isoDate: string | null | undefined): string | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isOverdue = (issue: Issue): boolean => {
  if (!issue.dueDate || issue.status === 'DONE') return false;
  const due = new Date(issue.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
};

const getShortReporter = (issue: Issue): string | null => {
  const full = issue.reporter?.fullName?.trim();
  if (!full) return null;
  const parts = full.split(/\s+/);
  return parts[0] || full;
};

interface CardBodyProps {
  issue: Issue;
  canDrag: boolean;
  isUpdating?: boolean;
  isDragging?: boolean;
  showProjectBadge?: boolean;
  onOpenIssue?: (issue: Issue) => void;
  dragHandleProps?: Record<string, any>;
}

const CardSurface: React.FC<CardBodyProps> = ({
  issue,
  canDrag,
  isUpdating = false,
  isDragging = false,
  showProjectBadge = false,
  onOpenIssue,
  dragHandleProps,
}) => {
  const formattedDue = formatDueDate(issue.dueDate);
  const overdue = isOverdue(issue);
  const shortReporter = getShortReporter(issue);

  return (
    <article
      data-testid={`kanban-card-${issue.issueKey}`}
      className={`bg-white rounded-lg border p-3.5 transition-colors select-none ${
        isDragging
          ? 'border-blue-400 shadow-md ring-1 ring-blue-500/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Row: Issue Key (+ Project Code on Global Board) & Dedicated Drag Handle */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 text-xs">
          <span className="font-mono font-semibold text-slate-600 tabular-nums shrink-0">
            {issue.issueKey}
          </span>
          {showProjectBadge && issue.project?.name && (
            <>
              <span className="text-slate-300 shrink-0" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-500 truncate">{issue.project.name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isUpdating && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600"
              aria-live="polite"
            >
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              <span>Saving</span>
            </span>
          )}

          {canDrag ? (
            <button
              type="button"
              {...dragHandleProps}
              disabled={isUpdating}
              aria-label={`Drag ${issue.issueKey}: ${issue.title}`}
              title="Drag to change status (Space or Enter to lift, Arrow keys to move)"
              className="p-1.5 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-40 disabled:cursor-not-allowed touch-none"
            >
              <GripVertical className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <span
              title="Read-only access: Viewers cannot change issue status"
              aria-label={`${issue.issueKey} is read-only`}
              className="p-1 -mr-0.5 text-slate-300"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>

      {/* Main Clickable Card Body */}
      <button
        type="button"
        onClick={() => onOpenIssue?.(issue)}
        className="w-full text-left block group focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
      >
        <h3 className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors leading-snug break-words">
          {issue.title}
        </h3>

        <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
          <IssueType type={issue.type} />
          <span className="text-slate-300 text-xs" aria-hidden="true">
            ·
          </span>
          <IssuePriority priority={issue.priority} />
        </div>
      </button>

      {/* Footer Metadata: Assignee, Due Date & Reporter */}
      <div className="flex items-center justify-between gap-2 pt-2.5 mt-3 border-t border-slate-100">
        <IssueAssignee assignee={issue.assignee} className="max-w-[55%]" />

        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
          {formattedDue && (
            <span
              className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                overdue ? 'text-rose-600 font-semibold' : 'text-slate-500'
              }`}
              title={overdue ? 'Past due date' : 'Due date'}
            >
              <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{formattedDue}</span>
            </span>
          )}
          {!formattedDue && shortReporter && (
            <span
              className="truncate max-w-[5.5rem] text-slate-400"
              title={`Reported by ${issue.reporter?.fullName}`}
            >
              By {shortReporter}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const KanbanCard: React.FC<KanbanCardProps> = ({
  issue,
  canDrag,
  isUpdating = false,
  showProjectBadge = false,
  onOpenIssue,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
    data: {
      type: 'issue',
      issue,
    },
    disabled: !canDrag || isUpdating,
  });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-35 transition-opacity' : 'transition-opacity'}
    >
      <CardSurface
        issue={issue}
        canDrag={canDrag}
        isUpdating={isUpdating}
        showProjectBadge={showProjectBadge}
        onOpenIssue={onOpenIssue}
        dragHandleProps={canDrag ? { ...listeners, ...attributes } : undefined}
      />
    </div>
  );
};

export const KanbanCardOverlay: React.FC<{
  issue: Issue;
  showProjectBadge?: boolean;
}> = ({ issue, showProjectBadge = false }) => {
  return (
    <div className="w-[300px] sm:w-[320px] pointer-events-none">
      <CardSurface
        issue={issue}
        canDrag={true}
        isDragging={true}
        showProjectBadge={showProjectBadge}
      />
    </div>
  );
};
