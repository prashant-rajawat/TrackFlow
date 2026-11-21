import React from 'react';
import { X } from 'lucide-react';
import { ActiveFilterChip } from '../../utils/issueQuery';

interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
  onRemoveChip: (chip: ActiveFilterChip) => void;
  onResetAll: () => void;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  chips,
  onRemoveChip,
  onResetAll,
}) => {
  if (chips.length === 0) return null;

  return (
    <div
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-2 pt-1"
    >
      <span className="text-xs font-medium text-slate-500">Active:</span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemoveChip(chip)}
          aria-label={`Remove ${chip.label}`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200/70 transition-colors"
        >
          <span>{chip.label}</span>
          <X className="w-3 h-3 text-slate-500" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="text-xs font-medium text-blue-600 hover:text-blue-800 px-1.5 py-1 transition-colors"
      >
        Reset Filters
      </button>
    </div>
  );
};
