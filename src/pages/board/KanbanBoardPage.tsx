import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Kanban,
  Plus,
  ArrowLeft,
  Search,
  X,
  FolderGit2,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  DatabaseZap,
  List,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { issueService } from '../../services/issue.service';
import { projectService } from '../../services/project.service';
import {
  Issue,
  IssuePermissions,
  IssuePriority,
  IssueStatus,
  ProjectWithIssuePermissions,
} from '../../types/issue';
import { Project, ProjectMember } from '../../types/project';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { CreateIssueModal } from '../../components/issues/CreateIssueModal';
import { KanbanBoard } from '../../components/board/KanbanBoard';
import { getPermissionsCanUpdateStatus } from '../../components/board/KanbanColumn';
import { KanbanIssueDrawer } from '../../components/board/KanbanIssueDrawer';
import {
  BoardFilterState,
  DEFAULT_BOARD_FILTERS,
  extractBoardAssignees,
  filterBoardIssues,
  hasActiveBoardFilters,
} from '../../utils/boardFilters';

const READ_ONLY_PERMISSIONS: IssuePermissions = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canAssign: false,
  canUpdateStatus: false,
  canUpdatePriority: false,
  canDelete: false,
  canViewComments: true,
  canCreateComment: false,
  canModerateComments: false,
  canViewAttachments: true,
  canUploadAttachments: false,
  canDeleteOwnAttachment: false,
  canDeleteAnyAttachment: false,
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export const KanbanBoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [accessibleProjects, setAccessibleProjects] = useState<ProjectWithIssuePermissions[]>([]);
  const [projectPermissions, setProjectPermissions] = useState<IssuePermissions>(READ_ONLY_PERMISSIONS);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('');

  const [filters, setFilters] = useState<BoardFilterState>(DEFAULT_BOARD_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [mutationBannerError, setMutationBannerError] = useState<string | null>(null);

  const [pendingIssueIds, setPendingIssueIds] = useState<Set<string>>(() => new Set());
  const inFlightIssueIdsRef = useRef<Set<string>>(new Set());
  const loadSequenceRef = useRef(0);
  const prevWorkspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);

  // Modals / Drawers
  const [createModalState, setCreateModalState] = useState<{
    isOpen: boolean;
    defaultStatus?: IssueStatus;
  }>({ isOpen: false });
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Reset global project filter & close active drawer when workspace changes
  useEffect(() => {
    const prevWs = prevWorkspaceIdRef.current;
    const nextWs = currentWorkspace?.id;
    if (prevWs && nextWs && prevWs !== nextWs) {
      setSelectedProjectFilter('');
      setSelectedIssueId(null);
      setFilters(DEFAULT_BOARD_FILTERS);
      setMutationBannerError(null);
      if (projectId) {
        navigate('/board', { replace: true });
      }
    }
    prevWorkspaceIdRef.current = nextWs;
  }, [currentWorkspace?.id, projectId, navigate]);

  const loadBoard = useCallback(async () => {
    const requestSeq = ++loadSequenceRef.current;
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    setMutationBannerError(null);
    setIssues([]);

    try {
      if (projectId) {
        const [issueData, members] = await Promise.all([
          issueService.listProjectIssues(projectId, { limit: 100 }),
          projectService.listProjectMembers(projectId).catch(() => [] as ProjectMember[]),
        ]);

        if (requestSeq !== loadSequenceRef.current) return;

        setIssues(issueData.issues);
        setProject(issueData.project);
        setAccessibleProjects([]);
        setProjectMembers(members);
        setProjectPermissions(issueData.permissions || READ_ONLY_PERMISSIONS);
      } else if (currentWorkspace) {
        const res = await issueService.listWorkspaceIssues(currentWorkspace.id, {
          projectId: selectedProjectFilter ? [selectedProjectFilter] : undefined,
          limit: 100,
        });

        if (requestSeq !== loadSequenceRef.current) return;

        setIssues(res.issues);
        setAccessibleProjects(res.projects);

        const activeTargetProject =
          (selectedProjectFilter && res.projects.find((p) => p.id === selectedProjectFilter)) ||
          res.projects.find((p) => p.issuePermissions?.canCreate) ||
          res.projects[0] ||
          null;

        setProject(activeTargetProject);
        setProjectPermissions(activeTargetProject?.issuePermissions || READ_ONLY_PERMISSIONS);

        if (selectedProjectFilter) {
          const members = await projectService
            .listProjectMembers(selectedProjectFilter)
            .catch(() => [] as ProjectMember[]);
          if (requestSeq === loadSequenceRef.current) {
            setProjectMembers(members);
          }
        } else {
          setProjectMembers([]);
        }
      } else {
        setIssues([]);
        setAccessibleProjects([]);
        setProject(null);
        setProjectMembers([]);
        setProjectPermissions(READ_ONLY_PERMISSIONS);
      }
    } catch (err: any) {
      if (requestSeq !== loadSequenceRef.current) return;
      setErrorStatus(typeof err?.status === 'number' ? err.status : null);
      setError(err?.message || 'Unable to load Kanban board');
      setIssues([]);
    } finally {
      if (requestSeq === loadSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId, currentWorkspace?.id, selectedProjectFilter]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Build project-level permission map for Global Board multi-project authorization checks
  const projectPermissionsMap = useMemo(() => {
    const map = new Map<string, IssuePermissions>();
    for (const proj of accessibleProjects) {
      if (proj.issuePermissions) {
        map.set(proj.id, proj.issuePermissions);
      }
    }
    if (project && projectPermissions) {
      map.set(project.id, projectPermissions);
    }
    return map;
  }, [accessibleProjects, project, projectPermissions]);

  const canDragForIssue = useCallback(
    (issue: Issue): boolean => {
      return getPermissionsCanUpdateStatus(issue, projectPermissionsMap, projectPermissions);
    },
    [projectPermissionsMap, projectPermissions]
  );

  const assigneeOptions = useMemo(
    () => extractBoardAssignees(issues, projectMembers),
    [issues, projectMembers]
  );

  const filteredIssues = useMemo(
    () => filterBoardIssues(issues, filters),
    [issues, filters]
  );

  const filtersActive = hasActiveBoardFilters(filters);

  const handleMoveIssue = useCallback(
    async (issue: Issue, targetStatus: IssueStatus) => {
      if (issue.status === targetStatus) return;

      if (!canDragForIssue(issue)) {
        addToast('Viewers have read-only access and cannot change issue status.', 'error');
        return;
      }

      if (inFlightIssueIdsRef.current.has(issue.id)) {
        return;
      }

      const previousStatus = issue.status;
      const loadEpoch = loadSequenceRef.current;

      inFlightIssueIdsRef.current.add(issue.id);
      setPendingIssueIds((prev) => {
        const next = new Set(prev);
        next.add(issue.id);
        return next;
      });
      setMutationBannerError(null);

      // Optimistic UI update scoped strictly to the moved issue ID
      setIssues((prev) =>
        prev.map((item) => (item.id === issue.id ? { ...item, status: targetStatus } : item))
      );

      try {
        const res = await issueService.updateStatus(issue.id, targetStatus);
        if (loadEpoch === loadSequenceRef.current) {
          setIssues((prev) =>
            prev.map((item) => (item.id === issue.id ? res.issue : item))
          );
          addToast(`Moved ${issue.issueKey} to ${STATUS_LABELS[targetStatus]}`, 'success');
        }
      } catch (err: any) {
        if (loadEpoch === loadSequenceRef.current) {
          // Roll back ONLY the failed issue to its previous status
          setIssues((prev) =>
            prev.map((item) =>
              item.id === issue.id ? { ...item, status: previousStatus } : item
            )
          );

          const isDbUnavailable = err?.status === 503;
          const failureMessage = isDbUnavailable
            ? `Database unavailable: could not save status change for ${issue.issueKey}. Restored to ${STATUS_LABELS[previousStatus]}.`
            : err?.message || `Failed to move ${issue.issueKey} to ${STATUS_LABELS[targetStatus]}`;

          if (isDbUnavailable) {
            setMutationBannerError(failureMessage);
          }
          addToast(failureMessage, 'error');
        }
      } finally {
        inFlightIssueIdsRef.current.delete(issue.id);
        setPendingIssueIds((prev) => {
          const next = new Set(prev);
          next.delete(issue.id);
          return next;
        });
      }
    },
    [canDragForIssue, addToast]
  );

  const selectedIssue = useMemo(
    () => (selectedIssueId ? issues.find((i) => i.id === selectedIssueId) || null : null),
    [selectedIssueId, issues]
  );

  const isGlobalReadOnly =
    !isLoading &&
    !error &&
    issues.length > 0 &&
    !projectPermissions.canCreate &&
    !issues.some((i) => canDragForIssue(i));

  const showNoAccessibleProjectsEmpty =
    !projectId && !isLoading && !error && currentWorkspace && accessibleProjects.length === 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb Back Navigation for Project Boards */}
      {projectId && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Link
              to={`/projects/${projectId}`}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {project?.name || 'Project'}</span>
            </Link>
            {project?.key && (
              <>
                <span aria-hidden="true">/</span>
                <span className="font-mono text-slate-700">{project.key}</span>
              </>
            )}
          </div>

          <Link
            to={`/projects/${projectId}/issues`}
            className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
            <span>Issue List View</span>
          </Link>
        </div>
      )}

      {/* Board Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Kanban className="w-6 h-6 text-slate-900 shrink-0" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {projectId && project ? `${project.name} · Kanban Board` : 'Kanban Board'}
            </h1>
            <span
              data-testid="board-total-count"
              className="font-mono text-xs text-slate-500 tabular-nums"
            >
              ({filtersActive ? `${filteredIssues.length}/${issues.length}` : issues.length})
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {projectId
              ? project?.description ||
                `Visual workflow for ${project?.key || 'project'} across To Do, In Progress, and Done.`
              : `Drag and track issue progress across accessible projects in ${
                  currentWorkspace?.name || 'your workspace'
                }.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {!projectId && (
            <Link
              to="/issues"
              className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <List className="w-3.5 h-3.5" />
              <span>All Issues</span>
            </Link>
          )}

          {project && projectPermissions.canCreate && (
            <Button
              type="button"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalState({ isOpen: true, defaultStatus: undefined })}
            >
              Create Issue
            </Button>
          )}
        </div>
      </div>

      {/* Board Filter & Scope Bar */}
      {!error && !showNoAccessibleProjectsEmpty && (
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
            {/* Search by key or title */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search board issues"
                placeholder="Search by key or title..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
              />
            </div>

            {/* Project selector on Global Board */}
            {!projectId && accessibleProjects.length > 0 && (
              <select
                aria-label="Filter board by project"
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
              >
                <option value="">All Accessible Projects ({accessibleProjects.length})</option>
                {accessibleProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.key} · {proj.name}
                  </option>
                ))}
              </select>
            )}

            {/* Priority filter */}
            <select
              aria-label="Filter board by priority"
              value={filters.priority}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  priority: e.target.value as IssuePriority | '',
                }))
              }
              className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Assignee filter when actual assignees/members are available */}
            {(assigneeOptions.length > 0 || issues.length > 0) && (
              <select
                aria-label="Filter board by assignee"
                value={filters.assigneeId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, assigneeId: e.target.value }))
                }
                className="h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10"
              >
                <option value="">All Assignees</option>
                <option value="UNASSIGNED">Unassigned</option>
                {assigneeOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            {filtersActive && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<X className="w-3.5 h-3.5" />}
                onClick={() => setFilters(DEFAULT_BOARD_FILTERS)}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Read-only explanation when Viewer */}
      {isGlobalReadOnly && (
        <div className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Read-only board mode: Viewers can inspect issue cards and details, while Developers and Project Admins can drag cards to transition status.
          </span>
        </div>
      )}

      {/* Database / Mutation Failure Alert */}
      {mutationBannerError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <DatabaseZap className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            <span>{mutationBannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMutationBannerError(null)}
            aria-label="Dismiss error banner"
            className="p-1 text-rose-600 hover:bg-rose-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Board Content States */}
      {error ? (
        <div
          role="alert"
          className="bg-white rounded-xl border border-rose-200 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            {errorStatus === 403 ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : errorStatus === 503 ? (
              <DatabaseZap className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {errorStatus === 403
                  ? 'Access denied (403)'
                  : errorStatus === 503
                  ? 'Database unavailable (503)'
                  : 'Unable to load Kanban board'}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{error}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {errorStatus === 403 ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate('/board')}>
                  Go to Global Board
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
                  Go to Projects
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={loadBoard}
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      ) : showNoAccessibleProjectsEmpty ? (
        <EmptyState
          icon={<FolderGit2 className="w-6 h-6" />}
          title="No accessible projects in this workspace"
          description="Create a project or ask a project administrator to add you as a project member to view and manage a Kanban board."
          action={{
            label: 'Go to Projects',
            onClick: () => navigate('/projects'),
          }}
        />
      ) : !isLoading && issues.length === 0 ? (
        <EmptyState
          icon={<Kanban className="w-6 h-6" />}
          title="This board has no issues yet"
          description={
            projectPermissions.canCreate
              ? 'Create your first issue to start moving work across To Do, In Progress, and Done.'
              : 'No issues have been created in this board scope yet.'
          }
          action={
            project && projectPermissions.canCreate
              ? {
                  label: 'Create Issue',
                  onClick: () => setCreateModalState({ isOpen: true, defaultStatus: 'TODO' }),
                  icon: <Plus className="w-4 h-4" />,
                }
              : undefined
          }
        />
      ) : !isLoading && filtersActive && filteredIssues.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title="No issues match your current filters"
          description="Adjust your search query, priority, or assignee filter to see matching board cards."
          action={{
            label: 'Clear Filters',
            variant: 'secondary',
            onClick: () => setFilters(DEFAULT_BOARD_FILTERS),
          }}
        />
      ) : (
        <KanbanBoard
          issues={filteredIssues}
          isLoading={isLoading}
          canCreate={!!project && projectPermissions.canCreate}
          canDragForIssue={canDragForIssue}
          pendingIssueIds={pendingIssueIds}
          showProjectBadge={!projectId}
          onMoveIssue={handleMoveIssue}
          onAddIssue={(status) =>
            setCreateModalState({ isOpen: true, defaultStatus: status })
          }
          onOpenIssue={(issue) => setSelectedIssueId(issue.id)}
        />
      )}

      {/* Existing Create Issue Modal */}
      {project && (
        <CreateIssueModal
          isOpen={createModalState.isOpen}
          project={project}
          projectMembers={projectId || selectedProjectFilter ? projectMembers : undefined}
          defaultStatus={createModalState.defaultStatus}
          onClose={() => setCreateModalState({ isOpen: false })}
          onIssueCreated={(created) => {
            setIssues((prev) => [created, ...prev]);
          }}
        />
      )}

      {/* Slide-over Issue Details Drawer reusing IssueDetailsPanel */}
      <KanbanIssueDrawer
        issue={selectedIssue}
        initialPermissions={
          selectedIssue
            ? projectPermissionsMap.get(selectedIssue.projectId) || projectPermissions
            : undefined
        }
        onClose={() => setSelectedIssueId(null)}
        onIssueSynchronized={(updated) => {
          setIssues((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
        }}
        onIssueDeleted={(deletedId) => {
          setIssues((prev) => prev.filter((item) => item.id !== deletedId));
          setSelectedIssueId(null);
        }}
      />
    </div>
  );
};
