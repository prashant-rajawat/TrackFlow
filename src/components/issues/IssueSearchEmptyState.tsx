import React from 'react';
import { SearchX } from 'lucide-react';
import { Button } from '../common/Button';

interface IssueSearchEmptyStateProps {
  hasSearch?: boolean;
  onResetFilters: () => void;
}

export const IssueSearchEmptyState: React.FC<IssueSearchEmptyStateProps> = ({
  hasSearch = false,
  onResetFilters,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
        <SearchX className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        No matching issues found
      </h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">
        {hasSearch
          ? 'No issues matched your search keywords and active filter criteria. Try adjusting your query or clearing active filters.'
          : 'No issues match the selected filters. Reset or adjust your filter criteria to see issues.'}
      </p>
      <div className="mt-5">
        <Button type="button" variant="secondary" size="sm" onClick={onResetFilters}>
          Reset Search &amp; Filters
        </Button>
      </div>
    </div>
  );
};
