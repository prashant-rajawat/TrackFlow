import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  CreatedDatePreset,
  DueDatePreset,
  IssuePriority,
  IssueQueryState,
  IssueStatus,
  IssueType,
  IssueUserSummary,
  ProjectWithIssuePermissions,
} from '../../types/issue';
import {
  DUE_DATE_PRESET_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  VALID_DUE_DATE_PRESETS,
  VALID_ISSUE_PRIORITIES,
  VALID_ISSUE_STATUSES,
  VALID_ISSUE_TYPES,
} from '../../utils/issueQuery';

interface IssueFilterPanelProps {
  queryState: IssueQueryState;
  projects?: ProjectWithIssuePermissions[];
  members?: IssueUserSummary[];
  allowProjectFilter?: boolean;
  onChange: (updater: (prev: IssueQueryState) => IssueQueryState) => void;
  onResetAll: () => void;
}

const toggleArrayValue = <T extends string>(list: T[], value: T): T[] => {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
};

export const IssueFilterPanel: React.FC<IssueFilterPanelProps> = ({
  queryState,
  projects = [],
  members = [],
  allowProjectFilter = true,
  onChange,
  onResetAll,
}) => {
  const [useCustomDueRange, setUseCustomDueRange] = useState(
    !queryState.dueDatePreset && (!!queryState.dueDateFrom || !!queryState.dueDateTo)
  );

  const dueSelectValue = queryState.dueDatePreset
    ? queryState.dueDatePreset
    : useCustomDueRange || queryState.dueDateFrom || queryState.dueDateTo
    ? 'custom'
    : '';

  const createdSelectValue: CreatedDatePreset =
    queryState.createdPreset ||
    (queryState.createdFrom || queryState.createdTo ? 'custom' : '');

  return (
    <section
      aria-label="Issue filters"
      className="bg-white rounded-xl border border-slate-200 p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Filter Issues
        </h2>
        <button
          type="button"
          onClick={() => {
            setUseCustomDueRange(false);
            onResetAll();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Row 1: Workflow Status, Priority, Type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">Status</legend>
          <div className="flex flex-wrap gap-1.5">
            {VALID_ISSUE_STATUSES.map((status: IssueStatus) => {
              const active = queryState.status.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      status: toggleArrayValue(prev.status, status),
                      page: 1,
                    }))
                  }
                  className={`h-8 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">Priority</legend>
          <div className="flex flex-wrap gap-1.5">
            {VALID_ISSUE_PRIORITIES.map((priority: IssuePriority) => {
              const active = queryState.priority.includes(priority);
              return (
                <button
                  key={priority}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      priority: toggleArrayValue(prev.priority, priority),
                      page: 1,
                    }))
                  }
                  className={`h-8 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">Type</legend>
          <div className="flex flex-wrap gap-1.5">
            {VALID_ISSUE_TYPES.map((type: IssueType) => {
              const active = queryState.type.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      type: toggleArrayValue(prev.type, type),
                      page: 1,
                    }))
                  }
                  className={`h-8 px-2.5 text-xs font-medium rounded-lg border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Row 2: Assignee, Reporter, and Project (Global) */}
      <div
        className={`grid grid-cols-1 gap-4 ${
          allowProjectFilter && projects.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        }`}
      >
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">Assignee</legend>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1 bg-slate-50/40">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={queryState.assigneeId.includes('UNASSIGNED')}
                onChange={() =>
                  onChange((prev) => ({
                    ...prev,
                    assigneeId: toggleArrayValue(prev.assigneeId, 'UNASSIGNED'),
                    page: 1,
                  }))
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="font-medium text-slate-600">Unassigned</span>
            </label>
            {members.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-xs text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={queryState.assigneeId.includes(member.id)}
                  onChange={() =>
                    onChange((prev) => ({
                      ...prev,
                      assigneeId: toggleArrayValue(prev.assigneeId, member.id),
                      page: 1,
                    }))
                  }
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="truncate">{member.fullName}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-700">Reporter</legend>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1 bg-slate-50/40">
            {members.length === 0 ? (
              <div className="px-1.5 py-1 text-xs text-slate-400">No project members available</div>
            ) : (
              members.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={queryState.reporterId.includes(member.id)}
                    onChange={() =>
                      onChange((prev) => ({
                        ...prev,
                        reporterId: toggleArrayValue(prev.reporterId, member.id),
                        page: 1,
                      }))
                    }
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="truncate">{member.fullName}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        {allowProjectFilter && projects.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-700">Project</legend>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1 bg-slate-50/40">
              {projects.map((proj) => (
                <label
                  key={proj.id}
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={queryState.projectId.includes(proj.id)}
                    onChange={() =>
                      onChange((prev) => ({
                        ...prev,
                        projectId: toggleArrayValue(prev.projectId, proj.id),
                        page: 1,
                      }))
                    }
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">{proj.key}</span>
                  <span className="truncate">{proj.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {/* Row 3: Due Date & Creation Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="space-y-2">
          <label htmlFor="due-date-filter" className="block text-xs font-medium text-slate-700">
            Due Date
          </label>
          <select
            id="due-date-filter"
            aria-label="Due date filter"
            value={dueSelectValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                setUseCustomDueRange(true);
                onChange((prev) => ({
                  ...prev,
                  dueDatePreset: '',
                  page: 1,
                }));
              } else if (val === '') {
                setUseCustomDueRange(false);
                onChange((prev) => ({
                  ...prev,
                  dueDatePreset: '',
                  dueDateFrom: '',
                  dueDateTo: '',
                  page: 1,
                }));
              } else {
                setUseCustomDueRange(false);
                onChange((prev) => ({
                  ...prev,
                  dueDatePreset: val as DueDatePreset,
                  dueDateFrom: '',
                  dueDateTo: '',
                  page: 1,
                }));
              }
            }}
            className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
          >
            <option value="">Any due date</option>
            {VALID_DUE_DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {DUE_DATE_PRESET_LABELS[preset]}
              </option>
            ))}
            <option value="custom">Custom date range</option>
          </select>

          {dueSelectValue === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor="due-date-from" className="block text-[11px] text-slate-500 mb-1">
                  Due from
                </label>
                <input
                  id="due-date-from"
                  type="date"
                  value={queryState.dueDateFrom}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      dueDatePreset: '',
                      dueDateFrom: e.target.value,
                      page: 1,
                    }))
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-mono"
                />
              </div>
              <div>
                <label htmlFor="due-date-to" className="block text-[11px] text-slate-500 mb-1">
                  Due to
                </label>
                <input
                  id="due-date-to"
                  type="date"
                  value={queryState.dueDateTo}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      dueDatePreset: '',
                      dueDateTo: e.target.value,
                      page: 1,
                    }))
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="created-date-filter" className="block text-xs font-medium text-slate-700">
            Created Date
          </label>
          <select
            id="created-date-filter"
            aria-label="Created date filter"
            value={createdSelectValue}
            onChange={(e) => {
              const val = e.target.value as CreatedDatePreset;
              if (val === 'custom') {
                onChange((prev) => ({
                  ...prev,
                  createdPreset: 'custom',
                  page: 1,
                }));
              } else {
                onChange((prev) => ({
                  ...prev,
                  createdPreset: val,
                  createdFrom: '',
                  createdTo: '',
                  page: 1,
                }));
              }
            }}
            className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
          >
            <option value="">Any creation date</option>
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="custom">Custom date range</option>
          </select>

          {createdSelectValue === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label htmlFor="created-date-from" className="block text-[11px] text-slate-500 mb-1">
                  Created from
                </label>
                <input
                  id="created-date-from"
                  type="date"
                  value={queryState.createdFrom}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      createdPreset: 'custom',
                      createdFrom: e.target.value,
                      page: 1,
                    }))
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-mono"
                />
              </div>
              <div>
                <label htmlFor="created-date-to" className="block text-[11px] text-slate-500 mb-1">
                  Created to
                </label>
                <input
                  id="created-date-to"
                  type="date"
                  value={queryState.createdTo}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      createdPreset: 'custom',
                      createdTo: e.target.value,
                      page: 1,
                    }))
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
