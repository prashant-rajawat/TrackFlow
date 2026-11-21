import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  IssuePagination,
  IssueQueryState,
  IssueUserSummary,
  ProjectWithIssuePermissions,
} from '../../types/issue';
import {
  buildActiveFilterChips,
  countActiveFilters,
  removeActiveFilterChip,
} from '../../utils/issueQuery';
import { IssueSearchBar } from './IssueSearchBar';
import { IssueSortDropdown } from './IssueSortDropdown';
import { IssueFilterPanel } from './IssueFilterPanel';
import { ActiveFilterChips } from './ActiveFilterChips';
import { IssueResultsSummary } from './IssueResultsSummary';

interface IssueDiscoveryToolbarProps {
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  onSearchClear: () => void;
  queryState: IssueQueryState;
  onQueryChange: (updater: (prev: IssueQueryState) => IssueQueryState) => void;
  onResetAll: () => void;
  pagination: IssuePagination;
  isLoading?: boolean;
  projects?: ProjectWithIssuePermissions[];
  members?: IssueUserSummary[];
  allowProjectFilter?: boolean;
  defaultFiltersOpen?: boolean;
}

export const IssueDiscoveryToolbar: React.FC<IssueDiscoveryToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onSearchClear,
  queryState,
  onQueryChange,
  onResetAll,
  pagination,
  isLoading = false,
  projects = [],
  members = [],
  allowProjectFilter = true,
  defaultFiltersOpen = false,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);

  const activeCount = countActiveFilters(queryState, allowProjectFilter);
  const chips = buildActiveFilterChips(queryState, {
    projects,
    members,
    allowProjectFilter,
  });

  return (
    <div className="space-y-3">
      {/* Primary Command Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <IssueSearchBar
            value={searchInput}
            onChange={onSearchInputChange}
            onClear={onSearchClear}
            isLoading={isLoading}
          />

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-label="Toggle issue filters"
              className={`h-10 px-3 inline-flex items-center gap-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                filtersOpen || activeCount > 0
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span
                  data-testid="active-filter-count"
                  className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                    filtersOpen || activeCount > 0
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {activeCount}
                </span>
              )}
            </button>

            <IssueSortDropdown
              sortBy={queryState.sortBy}
              sortOrder={queryState.sortOrder}
              onSortByChange={(sortBy) =>
                onQueryChange((prev) => ({ ...prev, sortBy, page: 1 }))
              }
              onSortOrderToggle={() =>
                onQueryChange((prev) => ({
                  ...prev,
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                  page: 1,
                }))
              }
            />
          </div>
        </div>

        {/* Active filter chips + Results summary row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-slate-100">
          <IssueResultsSummary pagination={pagination} isLoading={isLoading} />
          {chips.length > 0 && (
            <ActiveFilterChips
              chips={chips}
              onRemoveChip={(chip) => {
                if (chip.category === 'search') {
                  onSearchClear();
                } else {
                  onQueryChange((prev) => removeActiveFilterChip(prev, chip));
                }
              }}
              onResetAll={onResetAll}
            />
          )}
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {filtersOpen && (
        <IssueFilterPanel
          queryState={queryState}
          projects={projects}
          members={members}
          allowProjectFilter={allowProjectFilter}
          onChange={onQueryChange}
          onResetAll={onResetAll}
        />
      )}
    </div>
  );
};
