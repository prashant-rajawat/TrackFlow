import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  KeyboardCoordinateGetter,
  closestCorners,
  useSensor,
  useSensors,
  Announcements,
} from '@dnd-kit/core';
import { Issue, IssueStatus } from '../../types/issue';
import { KANBAN_COLUMNS, KanbanColumn } from './KanbanColumn';
import { KanbanCardOverlay } from './KanbanCard';
import { groupIssuesByStatus } from '../../utils/boardFilters';

interface KanbanBoardProps {
  issues: Issue[];
  isLoading: boolean;
  canCreate: boolean;
  canDragForIssue: (issue: Issue) => boolean;
  pendingIssueIds: Set<string>;
  showProjectBadge?: boolean;
  onMoveIssue: (issue: Issue, targetStatus: IssueStatus) => Promise<void> | void;
  onAddIssue: (status: IssueStatus) => void;
  onOpenIssue: (issue: Issue) => void;
}

const COLUMN_ORDER: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

const STATUS_LABELS: Record<IssueStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

// Column-stepping keyboard coordinate getter so Left/Right arrow keys jump cleanly across status columns
const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { currentCoordinates, context } = args;
  const { droppableRects, over } = context;

  if (
    event.code !== 'ArrowRight' &&
    event.code !== 'ArrowLeft' &&
    event.code !== 'ArrowDown' &&
    event.code !== 'ArrowUp'
  ) {
    return undefined;
  }

  event.preventDefault();

  const currentStatus =
    (over?.id && COLUMN_ORDER.includes(over.id as IssueStatus)
      ? (over.id as IssueStatus)
      : undefined) ||
    (context.active?.data?.current?.issue?.status as IssueStatus | undefined) ||
    'TODO';

  const currentIndex = COLUMN_ORDER.indexOf(currentStatus);

  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
    const delta = event.code === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(COLUMN_ORDER.length - 1, currentIndex + delta));
    const targetStatus = COLUMN_ORDER[nextIndex];
    const targetRect = droppableRects.get(targetStatus);
    if (targetRect) {
      return {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + Math.min(80, targetRect.height / 2),
      };
    }
    return {
      x: currentCoordinates.x + delta * 320,
      y: currentCoordinates.y,
    };
  }

  // Fallback vertical nudge
  const yDelta = event.code === 'ArrowDown' ? 24 : -24;
  return {
    x: currentCoordinates.x,
    y: currentCoordinates.y + yDelta,
  };
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues,
  isLoading,
  canCreate,
  canDragForIssue,
  pendingIssueIds,
  showProjectBadge = false,
  onMoveIssue,
  onAddIssue,
  onOpenIssue,
}) => {
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [mobileStatus, setMobileStatus] = useState<IssueStatus>('TODO');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: kanbanKeyboardCoordinates,
    })
  );

  const grouped = groupIssuesByStatus(issues);

  const resolveDropStatus = (overId: string | number | undefined, overData?: any): IssueStatus | null => {
    if (!overId) return null;
    const idStr = String(overId);
    if (COLUMN_ORDER.includes(idStr as IssueStatus)) {
      return idStr as IssueStatus;
    }
    if (overData?.status && COLUMN_ORDER.includes(overData.status)) {
      return overData.status as IssueStatus;
    }
    if (overData?.issue?.status && COLUMN_ORDER.includes(overData.issue.status)) {
      return overData.issue.status as IssueStatus;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const draggedIssue = event.active.data.current?.issue as Issue | undefined;
    if (draggedIssue) {
      setActiveIssue(draggedIssue);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const draggedIssue =
      (active.data.current?.issue as Issue | undefined) ||
      issues.find((i) => i.id === String(active.id));

    if (!draggedIssue) return;

    const targetStatus = resolveDropStatus(over.id, over.data.current);
    if (!targetStatus || targetStatus === draggedIssue.status) {
      return;
    }

    onMoveIssue(draggedIssue, targetStatus);
  };

  const handleDragCancel = () => {
    setActiveIssue(null);
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const issue = active.data.current?.issue as Issue | undefined;
      if (!issue) return undefined;
      return `Picked up issue ${issue.issueKey} (${issue.title}) in ${STATUS_LABELS[issue.status]}.`;
    },
    onDragOver({ active, over }) {
      const issue = active.data.current?.issue as Issue | undefined;
      const targetStatus = over ? resolveDropStatus(over.id, over.data.current) : null;
      if (!issue || !targetStatus) return undefined;
      return `Issue ${issue.issueKey} is over ${STATUS_LABELS[targetStatus]} column.`;
    },
    onDragEnd({ active, over }) {
      const issue = active.data.current?.issue as Issue | undefined;
      const targetStatus = over ? resolveDropStatus(over.id, over.data.current) : null;
      if (!issue) return undefined;
      if (!targetStatus || targetStatus === issue.status) {
        return `Issue ${issue.issueKey} remained in ${STATUS_LABELS[issue.status]}.`;
      }
      return `Moved issue ${issue.issueKey} to ${STATUS_LABELS[targetStatus]}.`;
    },
    onDragCancel({ active }) {
      const issue = active.data.current?.issue as Issue | undefined;
      if (!issue) return undefined;
      return `Cancelled dragging issue ${issue.issueKey}.`;
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {/* Mobile Segmented Status Switcher (< 768px) */}
        <div
          role="tablist"
          aria-label="Kanban status columns"
          className="md:hidden grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200"
        >
          {KANBAN_COLUMNS.map((col) => {
            const isSelected = mobileStatus === col.status;
            const count = grouped[col.status].length;
            return (
              <button
                key={col.status}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setMobileStatus(col.status)}
                className={`min-h-[44px] px-2 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{col.title}</span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single Canonical Column Tree (1 column active on mobile, 3 side-by-side on tablet/desktop) */}
        <div className="grid grid-cols-1 md:grid-flow-col md:auto-cols-[minmax(260px,1fr)] lg:grid-flow-row lg:grid-cols-3 gap-4 lg:gap-5 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              issues={grouped[col.status]}
              isLoading={isLoading}
              canCreate={canCreate}
              canDragForIssue={canDragForIssue}
              pendingIssueIds={pendingIssueIds}
              showProjectBadge={showProjectBadge}
              className={col.status === mobileStatus ? 'flex' : 'hidden md:flex'}
              onAddIssue={onAddIssue}
              onOpenIssue={onOpenIssue}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {activeIssue ? (
          <KanbanCardOverlay issue={activeIssue} showProjectBadge={showProjectBadge} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
