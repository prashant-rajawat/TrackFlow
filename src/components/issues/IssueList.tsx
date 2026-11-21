import React from 'react';
import { Bug, Trash2, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { Issue } from '../../types/issue';
import { IssueType } from './IssueType';
import { IssuePriority } from './IssuePriority';
import { IssueStatus } from './IssueStatus';
import { IssueAssignee } from './IssueAssignee';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../common/Button';

interface IssueListProps {
  issues: Issue[];
  isLoading: boolean;
  error?: string | null;
  canCreate?: boolean;
  canDelete?: boolean;
  canDeleteIssue?: (issue: Issue) => boolean;
  showProjectColumn?: boolean;
  emptyStateOverride?: React.ReactNode;
  onRetry?: () => void;
  onCreateIssue?: () => void;
  onSelectIssue: (issue: Issue) => void;
  onRequestDelete?: (issue: Issue) => void;
}

const formatShortDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const IssueList: React.FC<IssueListProps> = ({
  issues,
  isLoading,
  error = null,
  canCreate = false,
  canDelete = false,
  canDeleteIssue,
  showProjectColumn = false,
  emptyStateOverride,
  onRetry,
  onCreateIssue,
  onSelectIssue,
  onRequestDelete,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="h-4 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-1/2 bg-slate-200 rounded" />
            </div>
            <div className="hidden sm:flex items-center gap-6">
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="bg-white rounded-xl border border-rose-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Unable to load issues</h3>
            <p className="text-xs text-slate-600 mt-0.5">{error}</p>
          </div>
        </div>
        {onRetry && (
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (issues.length === 0) {
    if (emptyStateOverride) {
      return <>{emptyStateOverride}</>;
    }
    return (
      <EmptyState
        icon={<Bug className="w-6 h-6" />}
        title="No issues filed yet"
        description={
          canCreate
            ? 'Report bugs, scope new features, or assign engineering tasks for this project.'
            : 'There are currently no issues tracked in this scope.'
        }
        action={
          canCreate && onCreateIssue
            ? {
                label: 'Create Issue',
                onClick: onCreateIssue,
                icon: <Plus className="w-4 h-4" />,
              }
            : undefined
        }
      />
    );
  }

  const showDeleteColumn = (canDelete || !!canDeleteIssue) && !!onRequestDelete;
  const canDeleteRow = (issue: Issue) =>
    Boolean(onRequestDelete && (canDeleteIssue ? canDeleteIssue(issue) : canDelete));

  return (
    <>
      {/* Desktop Structured Data Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 pl-5 pr-3 w-28">Key</th>
              <th className="py-3 px-3">Title & Type</th>
              {showProjectColumn && <th className="py-3 px-3 w-36">Project</th>}
              <th className="py-3 px-3 w-28">Priority</th>
              <th className="py-3 px-3 w-32">Status</th>
              <th className="py-3 px-3 w-44">Assignee</th>
              <th className="py-3 px-3 w-36 hidden lg:table-cell">Reporter</th>
              <th className="py-3 px-3 w-32">Updated</th>
              {showDeleteColumn && <th className="py-3 pl-3 pr-5 w-14 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {issues.map((issue) => (
              <tr
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
              >
                <td className="py-3.5 pl-5 pr-3 font-mono text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
                  {issue.issueKey}
                </td>
                <td className="py-3.5 px-3 min-w-0">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {issue.title}
                    </span>
                    <IssueType type={issue.type} />
                  </div>
                </td>
                {showProjectColumn && (
                  <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                    <span className="font-mono text-slate-500 mr-1.5">{issue.project?.key || '—'}</span>
                    <span className="truncate">{issue.project?.name || ''}</span>
                  </td>
                )}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <IssuePriority priority={issue.priority} />
                </td>
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <IssueStatus status={issue.status} />
                </td>
                <td className="py-3.5 px-3 whitespace-nowrap max-w-[11rem]">
                  <IssueAssignee assignee={issue.assignee} />
                </td>
                <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap hidden lg:table-cell truncate max-w-[9rem]">
                  {issue.reporter?.fullName || issue.reporter?.email || 'Unknown'}
                </td>
                <td className="py-3.5 px-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  {formatShortDate(issue.updatedAt)}
                </td>
                {showDeleteColumn && (
                  <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                    {canDeleteRow(issue) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestDelete?.(issue);
                        }}
                        aria-label={`Delete ${issue.issueKey}`}
                        title={`Delete ${issue.issueKey}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile High-Clarity Card List */}
      <div className="md:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {issues.map((issue) => (
          <div
            key={issue.id}
            onClick={() => onSelectIssue(issue)}
            className="p-4 space-y-2.5 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                  {issue.issueKey}
                </span>
                <IssueType type={issue.type} />
              </div>
              {canDeleteRow(issue) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete?.(issue);
                  }}
                  aria-label={`Delete ${issue.issueKey}`}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-md shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-sm font-medium text-slate-900 leading-snug">
              {issue.title}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-3">
                <IssuePriority priority={issue.priority} />
                <IssueStatus status={issue.status} />
              </div>
              <IssueAssignee assignee={issue.assignee} />
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span className="truncate">
                Reported by {issue.reporter?.fullName || 'Unknown'}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {formatShortDate(issue.updatedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
