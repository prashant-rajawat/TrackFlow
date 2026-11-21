import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Bug, Plus, ArrowLeft, FolderGit2, Kanban } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { projectService } from '../../services/project.service';
import { issueService } from '../../services/issue.service';
import { Project, ProjectMember } from '../../types/project';
import {
  Issue,
  IssuePagination as IssuePaginationMeta,
  IssuePermissions,
  IssueQueryState,
  IssueUserSummary,
  ProjectWithIssuePermissions,
} from '../../types/issue';
import {
  DEFAULT_ISSUE_QUERY_STATE,
  countActiveFilters,
  createFallbackPagination,
  parseSearchParamsToIssueQuery,
  serializeIssueQueryToSearchParams,
  toApiIssueQueryParams,
} from '../../utils/issueQuery';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { IssueList } from '../../components/issues/IssueList';
import { IssueDiscoveryToolbar } from '../../components/issues/IssueDiscoveryToolbar';
import { IssuePagination } from '../../components/issues/IssuePagination';
import { IssueSearchEmptyState } from '../../components/issues/IssueSearchEmptyState';
import { CreateIssueModal } from '../../components/issues/CreateIssueModal';
import { DeleteIssueDialog } from '../../components/issues/DeleteIssueDialog';

const DEFAULT_PERMISSIONS: IssuePermissions = {
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

const deriveMembersFromIssuesAndProject = (
  issues: Issue[],
  projectMembers: ProjectMember[]
): IssueUserSummary[] => {
  const map = new Map<string, IssueUserSummary>();
  for (const pm of projectMembers) {
    if (pm.user) {
      map.set(pm.user.id, {
        id: pm.user.id,
        fullName: pm.user.fullName,
        email: pm.user.email,
        avatarUrl: pm.user.avatarUrl,
      });
    }
  }
  for (const iss of issues) {
    if (iss.assignee && !map.has(iss.assignee.id)) {
      map.set(iss.assignee.id, iss.assignee);
    }
    if (iss.reporter && !map.has(iss.reporter.id)) {
      map.set(iss.reporter.id, iss.reporter);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
};

export const IssuesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const allowProjectFilter = !projectId;
  const queryState = useMemo(
    () => parseSearchParamsToIssueQuery(searchParams, { allowProjectFilter }),
    [searchParams, allowProjectFilter]
  );

  const [searchInput, setSearchInput] = useState(queryState.search);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<IssuePaginationMeta>(() =>
    createFallbackPagination(0, queryState.page, queryState.limit)
  );
  const [project, setProject] = useState<Project | null>(null);
  const [accessibleProjects, setAccessibleProjects] = useState<ProjectWithIssuePermissions[]>([]);
  const [permissions, setPermissions] = useState<IssuePermissions>(DEFAULT_PERMISSIONS);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [filterMembers, setFilterMembers] = useState<IssueUserSummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevWorkspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);

  // Keep search input synchronized with URL query changes (e.g., Back/Forward or Reset)
  useEffect(() => {
    setSearchInput(queryState.search);
  }, [queryState.search]);

  const updateQueryState = useCallback(
    (updater: (prev: IssueQueryState) => IssueQueryState, replace = false) => {
      const next = updater(queryState);
      const nextParams = serializeIssueQueryToSearchParams(next, { allowProjectFilter });
      setSearchParams(nextParams, { replace });
    },
    [queryState, allowProjectFilter, setSearchParams]
  );

  // Debounce search input (300ms) -> sync into URL query params
  useEffect(() => {
    if (searchInput === queryState.search) return;
    const timer = window.setTimeout(() => {
      updateQueryState(
        (prev) => ({
          ...prev,
          search: searchInput,
          page: 1,
        }),
        true
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, queryState.search, updateQueryState]);

  // Reset filters when switching workspaces
  useEffect(() => {
    const prevWs = prevWorkspaceIdRef.current;
    const nextWs = currentWorkspace?.id;
    if (prevWs && nextWs && prevWs !== nextWs) {
      setSearchInput('');
      if (projectId) {
        navigate('/issues', { replace: true });
      } else {
        setSearchParams(new URLSearchParams(), { replace: true });
      }
    }
    prevWorkspaceIdRef.current = nextWs;
  }, [currentWorkspace?.id, projectId, navigate, setSearchParams]);

  const handleResetAllFilters = useCallback(() => {
    setSearchInput('');
    const resetParams = serializeIssueQueryToSearchParams(
      {
        ...DEFAULT_ISSUE_QUERY_STATE,
        sortBy: queryState.sortBy,
        sortOrder: queryState.sortOrder,
        limit: queryState.limit,
      },
      { allowProjectFilter }
    );
    setSearchParams(resetParams);
  }, [allowProjectFilter, queryState.limit, queryState.sortBy, queryState.sortOrder, setSearchParams]);

  const loadIssues = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqSeq = ++requestSeqRef.current;

    setIsLoading(true);
    setError(null);

    const apiQuery = toApiIssueQueryParams(queryState, { allowProjectFilter });

    try {
      if (projectId) {
        const [issueData, members] = await Promise.all([
          issueService.listProjectIssues(projectId, apiQuery, { signal: controller.signal }),
          projectService.listProjectMembers(projectId).catch(() => [] as ProjectMember[]),
        ]);

        if (reqSeq !== requestSeqRef.current || controller.signal.aborted) return;

        setIssues(issueData.issues);
        setPagination(
          issueData.pagination ??
            createFallbackPagination(issueData.issues.length, queryState.page, queryState.limit)
        );
        setProject(issueData.project);
        setProjectMembers(members);
        setFilterMembers(
          issueData.members ?? deriveMembersFromIssuesAndProject(issueData.issues, members)
        );
        if (issueData.permissions) {
          setPermissions(issueData.permissions);
        }
      } else if (currentWorkspace) {
        const res = await issueService.listWorkspaceIssues(currentWorkspace.id, apiQuery, {
          signal: controller.signal,
        });

        if (reqSeq !== requestSeqRef.current || controller.signal.aborted) return;

        setIssues(res.issues);
        setPagination(
          res.pagination ??
            createFallbackPagination(res.issues.length, queryState.page, queryState.limit)
        );
        setAccessibleProjects(res.projects);
        setFilterMembers(
          res.members ?? deriveMembersFromIssuesAndProject(res.issues, [])
        );

        const selectedSingleProject =
          queryState.projectId.length === 1
            ? res.projects.find((p) => p.id === queryState.projectId[0])
            : undefined;
        const activeTargetProject =
          selectedSingleProject ||
          res.projects.find((p) => p.issuePermissions?.canCreate) ||
          res.projects[0] ||
          null;
        setProject(activeTargetProject);

        if (activeTargetProject?.issuePermissions) {
          setPermissions(activeTargetProject.issuePermissions);
        } else {
          setPermissions(DEFAULT_PERMISSIONS);
        }
      } else {
        setIssues([]);
        setPagination(createFallbackPagination(0, 1, queryState.limit));
        setAccessibleProjects([]);
        setFilterMembers([]);
        setProject(null);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (reqSeq !== requestSeqRef.current) return;
      setError(err?.message || 'Failed to load issues');
    } finally {
      if (reqSeq === requestSeqRef.current && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [projectId, currentWorkspace?.id, queryState, allowProjectFilter]);

  useEffect(() => {
    loadIssues();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadIssues]);

  const handleConfirmDelete = async () => {
    if (!issueToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await issueService.deleteIssue(issueToDelete.id);
      addToast(`Deleted ${issueToDelete.issueKey}`, 'success');
      setIssueToDelete(null);
      await loadIssues();
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete issue';
      setDeleteError(msg);
      addToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const projectPermissionsById = useMemo(() => {
    const map = new Map<string, IssuePermissions>();
    for (const p of accessibleProjects) {
      if (p.issuePermissions) {
        map.set(p.id, p.issuePermissions);
      }
    }
    return map;
  }, [accessibleProjects]);

  const canDeleteIssueInRow = useCallback(
    (issue: Issue): boolean => {
      if (projectId) return permissions.canDelete;
      return Boolean(projectPermissionsById.get(issue.projectId)?.canDelete);
    },
    [projectId, permissions.canDelete, projectPermissionsById]
  );

  const canDeleteInList = projectId
    ? permissions.canDelete
    : accessibleProjects.some((p) => p.issuePermissions?.canDelete);

  const activeFilterCount = countActiveFilters(queryState, allowProjectFilter);
  const showOnboardingEmpty =
    !projectId && !isLoading && !error && accessibleProjects.length === 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {projectId && (
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {project?.name || 'Project'}</span>
        </Link>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <Bug className="w-6 h-6 text-slate-900 shrink-0" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {projectId ? `${project?.name || 'Project'} Issues` : 'All Issues'}
            </h1>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({pagination.totalItems})
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {projectId
              ? project?.description || `Tracked bugs, features, and tasks for ${project?.key || 'this project'}.`
              : `Issues across your accessible projects in ${currentWorkspace?.name || 'workspace'}.`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={projectId ? `/projects/${projectId}/board` : '/board'}
            className="inline-flex items-center gap-1.5 h-10 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Kanban Board</span>
          </Link>

          {project && permissions.canCreate && (
            <Button
              type="button"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Issue
            </Button>
          )}
        </div>
      </div>

      {showOnboardingEmpty ? (
        <EmptyState
          icon={<FolderGit2 className="w-6 h-6" />}
          title="No accessible projects in this workspace"
          description="Create a project or ask a project administrator to add you as a project member before creating or viewing issues."
          action={{
            label: 'Go to Projects',
            onClick: () => navigate('/projects'),
          }}
        />
      ) : (
        <>
          <IssueDiscoveryToolbar
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearchClear={() => {
              setSearchInput('');
              updateQueryState((prev) => ({ ...prev, search: '', page: 1 }), true);
            }}
            queryState={queryState}
            onQueryChange={(updater) => updateQueryState(updater)}
            onResetAll={handleResetAllFilters}
            pagination={pagination}
            isLoading={isLoading}
            projects={accessibleProjects}
            members={filterMembers}
            allowProjectFilter={allowProjectFilter}
          />

          <IssueList
            issues={issues}
            isLoading={isLoading}
            error={error}
            canCreate={!!project && permissions.canCreate}
            canDelete={canDeleteInList}
            canDeleteIssue={canDeleteIssueInRow}
            showProjectColumn={!projectId}
            emptyStateOverride={
              activeFilterCount > 0 ? (
                <IssueSearchEmptyState
                  hasSearch={queryState.search.trim().length > 0}
                  onResetFilters={handleResetAllFilters}
                />
              ) : undefined
            }
            onRetry={loadIssues}
            onCreateIssue={() => setIsCreateModalOpen(true)}
            onSelectIssue={(selected) =>
              navigate(`/projects/${selected.projectId}/issues/${selected.id}`)
            }
            onRequestDelete={(target) => {
              setDeleteError(null);
              setIssueToDelete(target);
            }}
          />

          {!isLoading && !error && pagination.totalItems > 0 && (
            <IssuePagination
              pagination={pagination}
              onPageChange={(nextPage) =>
                updateQueryState((prev) => ({ ...prev, page: nextPage }))
              }
              onPageSizeChange={(nextLimit) =>
                updateQueryState((prev) => ({ ...prev, limit: nextLimit, page: 1 }))
              }
            />
          )}
        </>
      )}

      {project && (
        <CreateIssueModal
          isOpen={isCreateModalOpen}
          project={project}
          projectMembers={projectId ? projectMembers : undefined}
          onClose={() => setIsCreateModalOpen(false)}
          onIssueCreated={() => {
            loadIssues();
          }}
        />
      )}

      <DeleteIssueDialog
        isOpen={!!issueToDelete}
        issue={issueToDelete}
        isDeleting={isDeleting}
        error={deleteError}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteError(null);
            setIssueToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
