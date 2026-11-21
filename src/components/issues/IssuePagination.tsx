import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IssuePagination as IssuePaginationMeta } from '../../types/issue';
import { VALID_PAGE_SIZES } from '../../utils/issueQuery';

interface IssuePaginationProps {
  pagination: IssuePaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (limit: number) => void;
}

const getVisiblePages = (currentPage: number, totalPages: number): Array<number | 'ellipsis'> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) pages.push('ellipsis');
  for (let p = left; p <= right; p++) {
    pages.push(p);
  }
  if (right < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);

  return pages;
};

export const IssuePagination: React.FC<IssuePaginationProps> = ({
  pagination,
  onPageChange,
  onPageSizeChange,
}) => {
  const { currentPage, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage } =
    pagination;

  if (totalItems === 0) return null;

  const visiblePages = getVisiblePages(currentPage, Math.max(1, totalPages));

  return (
    <nav
      aria-label="Issue pagination"
      className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <label htmlFor="issue-page-size" className="font-medium text-slate-600">
          Rows per page
        </label>
        <select
          id="issue-page-size"
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 font-mono tabular-nums focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
        >
          {VALID_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-slate-400 tabular-nums hidden sm:inline">
          · Page {currentPage} of {Math.max(1, totalPages)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="h-10 px-3 inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Previous</span>
        </button>

        {visiblePages.map((item, idx) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-xs text-slate-400 select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === currentPage ? 'page' : undefined}
              className={`h-10 min-w-[40px] px-2.5 text-xs font-medium rounded-lg border font-mono tabular-nums transition-colors ${
                item === currentPage
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="h-10 px-3 inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:pointer-events-none transition-colors"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
