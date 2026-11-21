import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { IssueSortField, SortOrder } from '../../types/issue';
import { SORT_FIELD_LABELS, VALID_SORT_FIELDS } from '../../utils/issueQuery';

interface IssueSortDropdownProps {
  sortBy: IssueSortField;
  sortOrder: SortOrder;
  onSortByChange: (sortBy: IssueSortField) => void;
  onSortOrderToggle: () => void;
}

export const IssueSortDropdown: React.FC<IssueSortDropdownProps> = ({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderToggle,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="issue-sort-field" className="sr-only">
        Sort issues by
      </label>
      <select
        id="issue-sort-field"
        aria-label="Sort issues by"
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as IssueSortField)}
        className="h-10 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
      >
        {VALID_SORT_FIELDS.map((field) => (
          <option key={field} value={field}>
            Sort: {SORT_FIELD_LABELS[field]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onSortOrderToggle}
        aria-label={sortOrder === 'asc' ? 'Sort ascending (switch to descending)' : 'Sort descending (switch to ascending)'}
        title={sortOrder === 'asc' ? 'Ascending order' : 'Descending order'}
        className="h-10 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
      >
        {sortOrder === 'asc' ? (
          <>
            <ArrowUpNarrowWide className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Asc</span>
          </>
        ) : (
          <>
            <ArrowDownWideNarrow className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Desc</span>
          </>
        )}
      </button>
    </div>
  );
};
