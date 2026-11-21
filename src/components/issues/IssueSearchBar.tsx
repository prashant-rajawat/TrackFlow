import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface IssueSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const IssueSearchBar: React.FC<IssueSearchBarProps> = ({
  value,
  onChange,
  onClear,
  isLoading = false,
  placeholder = 'Search by key, title, description, assignee, or reporter...',
}) => {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <Search
        className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label="Search issues"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-9 pr-9 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
      />
      {isLoading && value.trim().length > 0 ? (
        <Loader2
          aria-label="Searching issues"
          className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
        />
      ) : value.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
};
