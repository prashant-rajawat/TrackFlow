import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectService } from '../../services/project.service';
import { issueService } from '../../services/issue.service';
import { Project, ProjectMember } from '../../types/project';
import {
  Issue,
  IssuePagination as IssuePaginationMeta,
  IssuePermissions,
  IssueQueryState,
  IssueUserSummary,
} from '../../types/issue';
import {
  DEFAULT_ISSUE_QUERY_STATE,
  countActiveFilters,
  createFallbackPagination,
  toApiIssueQueryParams,
} from '../../utils/issueQuery';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { ProjectSettingsTab } from '../../components/projects/ProjectSettingsTab';
import { ProjectMembersTab } from '../../components/projects/ProjectMembersTab';
import { IssueList } from '../../components/issues/IssueList';
import { IssueDiscoveryToolbar } from '../../components/issues/IssueDiscoveryToolbar';
import { IssuePagination } from '../../components/issues/IssuePagination';
import { IssueSearchEmptyState } from '../../components/issues/IssueSearchEmptyState';
import { CreateIssueModal } from '../../components/issues/CreateIssueModal';
import { DeleteIssueDialog } from '../../components/issues/DeleteIssueDialog';
import { FolderKanban, Users, Settings, ArrowLeft, Bug, Plus } from 'lucide-react';

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

export const ProjectDetailsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'members' | 'settings'>('overview');

  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<IssuePaginationMeta>(() =>
    createFallbackPagination(0, 1, 20)
  );
  const [queryState, setQueryState] = useState<IssueQueryState>(DEFAULT_ISSUE_QUERY_STATE);
  const [searchInput, setSearchInput] = useState('');
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issuePermissions, setIssuePermissions] = useState<IssuePermissions>(DEFAULT_PERMISSIONS);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [filterMembers, setFilterMembers] = useState<IssueUserSummary[]>([]);

  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [deleteIssueError, setDeleteIssueError] = useState<string | null>(null);

  const issuesReqSeqRef = useRef(0);
  const issuesAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQueryState(DEFAULT_ISSUE_QUERY_STATE);
    setSearchInput('');
  }, [projectId]);

  useEffect(() => {
    if (searchInput === queryState.search) return;
    const timer = window.setTimeout(() => {
      setQueryState((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, queryState.search]);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await projectService.getProject(projectId);
      setProject(data);
    } catch (err: any) {
      addToast(err.message || 'Failed to load project details', 'error');
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, addToast, navigate]);

  const fetchProjectIssues = useCallback(async () => {
    if (!projectId) return;
    issuesAbortRef.current?.abort();
    const controller = new AbortController();
    issuesAbortRef.current = controller;
    const seq = ++issuesReqSeqRef.current;

    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const apiQuery = toApiIssueQueryParams(queryState, { allowProjectFilter: false });
      const [issueRes, membersRes] = await Promise.all([
        issueService.listProjectIssues(projectId, apiQuery, { signal: controller.signal }),
        projectService.listProjectMembers(projectId).catch(() => [] as ProjectMember[]),
      ]);

      if (seq !== issuesReqSeqRef.current || controller.signal.aborted) return;

      setIssues(issueRes.issues);
      setPagination(
        issueRes.pagination ??
          createFallbackPagination(issueRes.issues.length, queryState.page, queryState.limit)
      );
      setProjectMembers(membersRes);
      setFilterMembers(
        issueRes.members ??
          membersRes
            .filter((m) => !!m.user)
            .map((m) => ({
              id: m.user!.id,
              fullName: m.user!.fullName,
              email: m.user!.email,
              avatarUrl: m.user!.avatarUrl,
            }))
      );
      if (issueRes.permissions) {
        setIssuePermissions(issueRes.permissions);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (seq !== issuesReqSeqRef.current) return;
      setIssuesError(err?.message || 'Unable to load project issues');
    } finally {
      if (seq === issuesReqSeqRef.current && !controller.signal.aborted) {
        setIssuesLoading(false);
      }
    }
  }, [projectId, queryState]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (activeTab === 'issues') {
      fetchProjectIssues();
    }
    return () => {
      issuesAbortRef.current?.abort();
    };
  }, [activeTab, fetchProjectIssues]);

  const handleResetIssueFilters = useCallback(() => {
    setSearchInput('');
    setQueryState((prev) => ({
      ...DEFAULT_ISSUE_QUERY_STATE,
      sortBy: prev.sortBy,
      sortOrder: prev.sortOrder,
      limit: prev.limit,
    }));
  }, []);

  const handleDeleteIssueConfirm = async () => {
    if (!issueToDelete) return;
    setIsDeletingIssue(true);
    setDeleteIssueError(null);
    try {
      await issueService.deleteIssue(issueToDelete.id);
      addToast(`Deleted ${issueToDelete.issueKey}`, 'success');
      setProject((prev) =>
        prev ? { ...prev, issueCount: Math.max(0, (prev.issueCount || 1) - 1) } : prev
      );
      setIssueToDelete(null);
      await fetchProjectIssues();
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete issue';
      setDeleteIssueError(msg);
      addToast(msg, 'error');
    } finally {
      setIsDeletingIssue(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-16 text-center text-slate-500">
        Loading project details...
      </div>
    );
  }

  if (!project) return null;

  const activeIssueFilters = countActiveFilters(queryState, false);
  const displayedIssueCount =
    activeTab === 'issues' && !issuesLoading && !issuesError && activeIssueFilters === 0
      ? pagination.totalItems
      : (project.issueCount ?? pagination.totalItems);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back link & Header */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-base shrink-0 border border-blue-100 font-mono">
              {project.key}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">
                  {project.visibility}
                </span>
                {project.status === 'ARCHIVED' && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                {project.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              to={`/projects/${project.id}/board`}
              className="text-xs font-medium text-slate-900 hover:text-blue-700 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Kanban Board
            </Link>
            <Link
              to={`/projects/${project.id}/issues`}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Open Full Issue List
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'issues'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bug className="w-4 h-4" />
          <span>Issues</span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            ({displayedIssueCount})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Project Summary</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setActiveTab('issues')}
                >
                  View Issues ({project.issueCount ?? 0})
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Project Key</span>
                  <span className="font-mono font-medium text-slate-900">{project.key}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Status</span>
                  <span className="font-medium text-slate-900 capitalize">{project.status.toLowerCase()}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Tracked Issues</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {project.issueCount ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Start Date</span>
                  <span className="text-slate-900">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Target Date</span>
                  <span className="text-slate-900">{project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Not set'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Members</span>
                  <span className="font-mono text-slate-900 tabular-nums">{project.memberCount ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Project Lead</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-sm">
                  {project.lead?.fullName ? project.lead.fullName.charAt(0).toUpperCase() : 'L'}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{project.lead?.fullName || 'Unassigned'}</div>
                  <div className="text-xs text-slate-500">{project.lead?.email || 'No lead email'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Project Issues ({pagination.totalItems})
              </h2>
              <p className="text-xs text-slate-500">
                {project.description || `Track and manage issues scoped to ${project.name}.`}
              </p>
            </div>
            {issuePermissions.canCreate && (
              <Button
                type="button"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateIssueOpen(true)}
              >
                Create Issue
              </Button>
            )}
          </div>

          <IssueDiscoveryToolbar
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearchClear={() => {
              setSearchInput('');
              setQueryState((prev) => ({ ...prev, search: '', page: 1 }));
            }}
            queryState={queryState}
            onQueryChange={setQueryState}
            onResetAll={handleResetIssueFilters}
            pagination={pagination}
            isLoading={issuesLoading}
            members={filterMembers}
            allowProjectFilter={false}
          />

          <IssueList
            issues={issues}
            isLoading={issuesLoading}
            error={issuesError}
            canCreate={issuePermissions.canCreate}
            canDelete={issuePermissions.canDelete}
            emptyStateOverride={
              activeIssueFilters > 0 ? (
                <IssueSearchEmptyState
                  hasSearch={queryState.search.trim().length > 0}
                  onResetFilters={handleResetIssueFilters}
                />
              ) : undefined
            }
            onRetry={fetchProjectIssues}
            onCreateIssue={() => setIsCreateIssueOpen(true)}
            onSelectIssue={(selected) => navigate(`/projects/${project.id}/issues/${selected.id}`)}
            onRequestDelete={(target) => {
              setDeleteIssueError(null);
              setIssueToDelete(target);
            }}
          />

          {!issuesLoading && !issuesError && pagination.totalItems > 0 && (
            <IssuePagination
              pagination={pagination}
              onPageChange={(nextPage) =>
                setQueryState((prev) => ({ ...prev, page: nextPage }))
              }
              onPageSizeChange={(nextLimit) =>
                setQueryState((prev) => ({ ...prev, limit: nextLimit, page: 1 }))
              }
            />
          )}

          <CreateIssueModal
            isOpen={isCreateIssueOpen}
            project={project}
            projectMembers={projectMembers}
            onClose={() => setIsCreateIssueOpen(false)}
            onIssueCreated={() => {
              setProject((prev) =>
                prev ? { ...prev, issueCount: (prev.issueCount || 0) + 1 } : prev
              );
              fetchProjectIssues();
            }}
          />

          <DeleteIssueDialog
            isOpen={!!issueToDelete}
            issue={issueToDelete}
            isDeleting={isDeletingIssue}
            error={deleteIssueError}
            onCancel={() => {
              if (!isDeletingIssue) {
                setDeleteIssueError(null);
                setIssueToDelete(null);
              }
            }}
            onConfirm={handleDeleteIssueConfirm}
          />
        </div>
      )}

      {activeTab === 'members' && <ProjectMembersTab project={project} />}

      {activeTab === 'settings' && (
        <ProjectSettingsTab
          project={project}
          onProjectUpdated={(updated) => setProject(updated)}
        />
      )}
    </div>
  );
};
