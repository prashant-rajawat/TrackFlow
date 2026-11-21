import React from 'react';
import { IssuePagination } from '../../types/issue';

interface IssueResultsSummaryProps {
  pagination: IssuePagination;
  isLoading?: boolean;
}

export const IssueResultsSummary: React.FC<IssueResultsSummaryProps> = ({
  pagination,
  isLoading = false,
}) => {
  if (isLoading && pagination.totalItems === 0) {
    return (
      <div className="text-xs text-slate-500 tabular-nums">
        Loading matching issues...
      </div>
    );
  }

  if (pagination.totalItems === 0) {
    return (
      <div className="text-xs text-slate-500 tabular-nums">
        Showing <span className="font-semibold text-slate-900">0</span> issues
      </div>
    );
  }

  const startItem = (pagination.currentPage - 1) * pagination.pageSize + 1;
  const endItem = Math.min(
    pagination.currentPage * pagination.pageSize,
    pagination.totalItems
  );

  return (
    <div className="text-xs text-slate-600 tabular-nums">
      Showing{' '}
      <span className="font-semibold text-slate-900">
        {startItem}–{endItem}
      </span>{' '}
      of <span className="font-semibold text-slate-900">{pagination.totalItems}</span>{' '}
      {pagination.totalItems === 1 ? 'issue' : 'issues'}
    </div>
  );
};
