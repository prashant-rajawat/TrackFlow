// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { KanbanBoardPage } from '../../src/pages/board/KanbanBoardPage';
import { ToastProvider } from '../../src/context/ToastContext';
import * as WorkspaceContextModule from '../../src/context/WorkspaceContext';
import { issueService } from '../../src/services/issue.service';
import { projectService } from '../../src/services/project.service';
import { Project, ProjectMember } from '../../src/types/project';
import { Issue, IssuePermissions } from '../../src/types/issue';

const mockProject: Project = {
  id: 'proj_1',
  name: 'Mobile Core',
  key: 'MOB',
  description: 'Mobile gateway platform',
  workspaceId: 'ws_1',
  createdBy: 'usr_1',
  status: 'ACTIVE',
  visibility: 'WORKSPACE',
  color: 'blue',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const mockMembers: ProjectMember[] = [
  {
    id: 'pm_1',
    projectId: 'proj_1',
    workspaceId: 'ws_1',
    userId: 'usr_1',
    role: 'PROJECT_ADMIN',
    joinedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    user: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
  },
  {
    id: 'pm_2',
    projectId: 'proj_1',
    workspaceId: 'ws_1',
    userId: 'usr_2',
    role: 'DEVELOPER',
    joinedAt: '2026-10-02T00:00:00.000Z',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    user: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
  },
];

const adminPerms: IssuePermissions = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canAssign: true,
  canUpdateStatus: true,
  canUpdatePriority: true,
  canDelete: true,
};

const viewerPerms: IssuePermissions = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canAssign: false,
  canUpdateStatus: false,
  canUpdatePriority: false,
  canDelete: false,
};

const issueTodo: Issue = {
  id: 'iss_1',
  title: 'Auth token expiry check',
  description: 'Verify refresh window edge case.',
  issueKey: 'MOB-1',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  reporterId: 'usr_1',
  assigneeId: 'usr_2',
  type: 'BUG',
  priority: 'CRITICAL',
  status: 'TODO',
  dueDate: '2027-02-01T00:00:00.000Z',
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  reporter: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
  assignee: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
  project: { id: 'proj_1', name: 'Mobile Core', key: 'MOB', workspaceId: 'ws_1' },
};

const issueInProgress: Issue = {
  id: 'iss_2',
  title: 'Dark mode palette contrast',
  description: 'Audit muted labels for WCAG AA.',
  issueKey: 'MOB-2',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  reporterId: 'usr_2',
  assigneeId: null,
  type: 'FEATURE',
  priority: 'LOW',
  status: 'IN_PROGRESS',
  dueDate: null,
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  reporter: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
  assignee: null,
  project: { id: 'proj_1', name: 'Mobile Core', key: 'MOB', workspaceId: 'ws_1' },
};

const issueDone: Issue = {
  id: 'iss_3',
  title: 'Release pipeline build cache',
  description: 'Warm docker cache in CI.',
  issueKey: 'MOB-3',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  reporterId: 'usr_1',
  assigneeId: 'usr_1',
  type: 'TASK',
  priority: 'MEDIUM',
  status: 'DONE',
  dueDate: null,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
  reporter: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
  assignee: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
  project: { id: 'proj_1', name: 'Mobile Core', key: 'MOB', workspaceId: 'ws_1' },
};

const mockWorkspaceContext = () => {
  vi.spyOn(WorkspaceContextModule, 'useWorkspace').mockReturnValue({
    workspaces: [],
    currentWorkspace: {
      id: 'ws_1',
      name: 'Acme Engineering',
      slug: 'acme-eng',
      ownerId: 'usr_1',
      role: 'OWNER',
      memberCount: 2,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    currentRole: 'OWNER',
    isLoadingWorkspaces: false,
    switchWorkspace: vi.fn(),
    refreshWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
  });
};

const installBoardRectsMock = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const overlayEl =
      this.style?.position === 'fixed'
        ? this
        : this.parentElement?.style?.position === 'fixed'
        ? this.parentElement
        : null;
    if (overlayEl && overlayEl.style?.left !== '') {
      const left = parseFloat(overlayEl.style.left) || 0;
      const top = parseFloat(overlayEl.style.top) || 0;
      const width = parseFloat(overlayEl.style.width) || 300;
      const height = parseFloat(overlayEl.style.height) || 120;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        toJSON: () => ({}),
      } as DOMRect;
    }
    const status = this.getAttribute('data-status') || this.closest('[data-status]')?.getAttribute('data-status');
    if (status === 'TODO') {
      return { x: 40, y: 80, left: 0, top: 0, right: 300, bottom: 600, width: 300, height: 600, toJSON: () => ({}) } as DOMRect;
    }
    if (status === 'IN_PROGRESS') {
      return { x: 360, y: 80, left: 320, top: 0, right: 620, bottom: 600, width: 300, height: 600, toJSON: () => ({}) } as DOMRect;
    }
    if (status === 'DONE') {
      return { x: 680, y: 80, left: 640, top: 0, right: 940, bottom: 600, width: 300, height: 600, toJSON: () => ({}) } as DOMRect;
    }
    return { x: 40, y: 80, left: 40, top: 80, right: 260, bottom: 180, width: 220, height: 100, toJSON: () => ({}) } as DOMRect;
  });
};

const renderProjectBoard = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/projects/proj_1/board']}>
        <Routes>
          <Route path="/projects/:projectId/board" element={<KanbanBoardPage />} />
          <Route path="/board" element={<KanbanBoardPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

const renderGlobalBoard = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/board']}>
        <Routes>
          <Route path="/board" element={<KanbanBoardPage />} />
          <Route path="/projects/:projectId/board" element={<KanbanBoardPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

describe('TrackFlow Phase 5: Interactive Kanban Board UI & Integration', () => {
  beforeEach(() => {
    mockWorkspaceContext();
    installBoardRectsMock();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading skeletons, populates three columns with accurate counts, and displays empty column states', async () => {
    let resolveLoad!: (value: any) => void;
    vi.spyOn(issueService, 'listProjectIssues').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        })
    );
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    renderProjectBoard();

    // Loading state renders skeletons in columns
    expect(screen.getAllByTestId('column-skeleton-TODO').length).toBeGreaterThan(0);

    resolveLoad({
      issues: [issueTodo, issueInProgress], // 1 TODO, 1 IN_PROGRESS, 0 DONE
      project: mockProject,
      permissions: adminPerms,
    });

    const todoCol = await screen.findByTestId('kanban-column-TODO');
    const inProgCol = screen.getByTestId('kanban-column-IN_PROGRESS');
    const doneCol = screen.getByTestId('kanban-column-DONE');

    expect(within(todoCol).getByText('MOB-1')).toBeTruthy();
    expect(within(inProgCol).getByText('MOB-2')).toBeTruthy();
    expect(within(doneCol).getByText(/no completed issues/i)).toBeTruthy();

    expect(screen.getByTestId('column-count-TODO').textContent).toBe('1');
    expect(screen.getByTestId('column-count-IN_PROGRESS').textContent).toBe('1');
    expect(screen.getByTestId('column-count-DONE').textContent).toBe('0');
  });

  it('triggers dnd-kit drag-and-drop status update, optimistically moves the card, and rolls back cleanly on API failure', async () => {
    const user = userEvent.setup();
    vi.spyOn(issueService, 'listProjectIssues').mockResolvedValue({
      issues: [issueTodo, issueInProgress, issueDone],
      project: mockProject,
      permissions: adminPerms,
    });
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    const updateStatusSpy = vi
      .spyOn(issueService, 'updateStatus')
      .mockResolvedValueOnce({
        issue: { ...issueTodo, status: 'IN_PROGRESS' },
        permissions: adminPerms,
      })
      .mockRejectedValueOnce(new Error('Database unavailable'));

    renderProjectBoard();

    await screen.findByTestId('kanban-card-MOB-1');
    const dragHandle = screen.getByRole('button', {
      name: /drag mob-1: auth token expiry check/i,
    });

    // Drag MOB-1 from TODO -> IN_PROGRESS via accessible KeyboardSensor (Space -> ArrowRight -> Space)
    dragHandle.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith('iss_1', 'IN_PROGRESS');
    });

    // Wait for optimistic transition + API resolution to finish re-enabling the drag handle
    await waitFor(() => {
      expect(screen.getByTestId('column-count-TODO').textContent).toBe('0');
      expect(screen.getByTestId('column-count-IN_PROGRESS').textContent).toBe('2');
      const handle = screen.getByRole('button', {
        name: /drag mob-1: auth token expiry check/i,
      }) as HTMLButtonElement;
      expect(handle.disabled).toBe(false);
    });

    // Now move MOB-1 from IN_PROGRESS -> DONE where API rejects -> rolls back to IN_PROGRESS
    const updatedHandle = screen.getByRole('button', {
      name: /drag mob-1: auth token expiry check/i,
    });
    updatedHandle.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith('iss_1', 'DONE');
    });

    await waitFor(() => {
      expect(screen.getByTestId('column-count-IN_PROGRESS').textContent).toBe('2');
      expect(screen.getByTestId('column-count-DONE').textContent).toBe('1');
      expect(
        within(screen.getByTestId('kanban-column-IN_PROGRESS')).getByText('MOB-1')
      ).toBeTruthy();
    });
  });

  it('disables drag handles for VIEWER role and displays read-only indicator', async () => {
    vi.spyOn(issueService, 'listProjectIssues').mockResolvedValue({
      issues: [issueTodo],
      project: mockProject,
      permissions: viewerPerms,
    });
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    renderProjectBoard();

    await screen.findByTestId('kanban-card-MOB-1');
    expect(screen.queryByRole('button', { name: /drag mob-1/i })).toBeNull();
    expect(screen.getByLabelText('MOB-1 is read-only')).toBeTruthy();
    expect(screen.getByText(/read-only board mode/i)).toBeTruthy();
  });

  it('supports search, priority filter, assignee filter, empty filter results state, and Clear Filters restore', async () => {
    const user = userEvent.setup();
    vi.spyOn(issueService, 'listWorkspaceIssues').mockResolvedValue({
      issues: [issueTodo, issueInProgress, issueDone],
      projects: [{ ...mockProject, currentUserProjectRole: 'PROJECT_ADMIN', issuePermissions: adminPerms }],
    });

    renderGlobalBoard();

    await screen.findByTestId('kanban-card-MOB-1');
    expect(screen.getByTestId('kanban-card-MOB-2')).toBeTruthy();
    expect(screen.getByTestId('kanban-card-MOB-3')).toBeTruthy();

    // Search filter
    const searchInput = screen.getByLabelText(/search board issues/i);
    await user.type(searchInput, 'MOB-2');
    expect(screen.queryByTestId('kanban-card-MOB-1')).toBeNull();
    expect(screen.getByTestId('kanban-card-MOB-2')).toBeTruthy();

    // Clear filters restores all 3 cards
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByTestId('kanban-card-MOB-1')).toBeTruthy();
    expect(screen.getByTestId('kanban-card-MOB-3')).toBeTruthy();

    // Priority filter
    await user.selectOptions(screen.getByLabelText(/filter board by priority/i), 'CRITICAL');
    expect(screen.getByTestId('kanban-card-MOB-1')).toBeTruthy();
    expect(screen.queryByTestId('kanban-card-MOB-2')).toBeNull();

    // Assignee filter mismatch shows Clear Filters empty state
    await user.selectOptions(screen.getByLabelText(/filter board by assignee/i), 'usr_1');
    expect(await screen.findByText(/no issues match your current filters/i)).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: /clear filters/i })[0]);
    await user.selectOptions(screen.getByLabelText(/filter board by assignee/i), 'usr_2');
    expect(screen.getByTestId('kanban-card-MOB-1')).toBeTruthy();
    expect(screen.queryByTestId('kanban-card-MOB-3')).toBeNull();
  });

  it('displays API error state with Retry and explicit 403 unauthorized project board state', async () => {
    const user = userEvent.setup();
    const unauthorizedErr: any = new Error('You must be an active member of this project to access its issues.');
    unauthorizedErr.status = 403;

    const networkErr: any = new Error('Server timeout');
    networkErr.status = 500;

    const listSpy = vi
      .spyOn(issueService, 'listProjectIssues')
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce({
        issues: [issueTodo],
        project: mockProject,
        permissions: adminPerms,
      })
      .mockRejectedValueOnce(unauthorizedErr);

    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    const { unmount } = renderProjectBoard();

    // Network error + Retry
    expect(await screen.findByText(/unable to load kanban board/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByTestId('kanban-card-MOB-1')).toBeTruthy();
    expect(listSpy).toHaveBeenCalledTimes(2);

    unmount();

    // 403 Unauthorized project access shows Access Denied (not Coming Soon / 404)
    renderProjectBoard();
    expect(await screen.findByText(/access denied \(403\)/i)).toBeTruthy();
  });

  it('integrates CreateIssueModal with column status preselection and synchronizes IssueDetailsPanel status changes back to the board', async () => {
    const user = userEvent.setup();
    vi.spyOn(issueService, 'listProjectIssues').mockResolvedValue({
      issues: [issueTodo],
      project: mockProject,
      permissions: adminPerms,
    });
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    const createdTicket: Issue = {
      ...issueInProgress,
      id: 'iss_new',
      issueKey: 'MOB-4',
      title: 'Column shortcut ticket',
      status: 'IN_PROGRESS',
    };
    const createSpy = vi.spyOn(issueService, 'createIssue').mockResolvedValue({
      issue: createdTicket,
      permissions: adminPerms,
    });

    vi.spyOn(issueService, 'getIssue').mockResolvedValue({
      issue: createdTicket,
      project: mockProject,
      permissions: adminPerms,
    });
    const statusSpy = vi.spyOn(issueService, 'updateStatus').mockResolvedValue({
      issue: { ...createdTicket, status: 'DONE' },
      permissions: adminPerms,
    });

    renderProjectBoard();

    await screen.findByTestId('kanban-card-MOB-1');

    // Click "+" inside In Progress column -> preselects IN_PROGRESS
    await user.click(screen.getByRole('button', { name: /add issue to in progress/i }));
    const createDialog = screen.getByRole('dialog');
    expect((within(createDialog).getByLabelText(/^status$/i) as HTMLSelectElement).value).toBe('IN_PROGRESS');

    await user.type(within(createDialog).getByLabelText(/issue title/i), 'Column shortcut ticket');
    await user.type(within(createDialog).getByLabelText(/description/i), 'Created directly into In Progress.');
    await user.click(within(createDialog).getByRole('button', { name: /^create issue$/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        'proj_1',
        expect.objectContaining({ status: 'IN_PROGRESS', title: 'Column shortcut ticket' })
      );
      expect(screen.getByTestId('column-count-IN_PROGRESS').textContent).toBe('1');
    });

    // Open MOB-4 card -> opens IssueDetailsPanel drawer -> change status to DONE -> closes drawer -> board updates cleanly
    await user.click(screen.getByText('Column shortcut ticket'));
    expect(await screen.findByRole('dialog', { name: /issue details for mob-4/i })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText(/issue status/i), 'DONE');
    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalledWith('iss_new', 'DONE');
    });

    await user.click(screen.getByRole('button', { name: /close issue details/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /issue details for mob-4/i })).toBeNull();
      expect(screen.getByTestId('column-count-IN_PROGRESS').textContent).toBe('0');
      expect(screen.getByTestId('column-count-DONE').textContent).toBe('1');
    });
  });

  it('supports mobile segmented status tabs and renders an actionable empty state when board has zero issues', async () => {
    const user = userEvent.setup();
    vi.spyOn(issueService, 'listProjectIssues')
      .mockResolvedValueOnce({
        issues: [],
        project: mockProject,
        permissions: adminPerms,
      })
      .mockResolvedValueOnce({
        issues: [issueTodo, issueInProgress, issueDone],
        project: mockProject,
        permissions: adminPerms,
      });
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    const { unmount } = renderProjectBoard();
    expect(await screen.findByText(/this board has no issues yet/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^create issue$/i }).length).toBeGreaterThanOrEqual(2);
    unmount();

    renderProjectBoard();
    await screen.findByTestId('kanban-card-MOB-1');

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    await user.click(tabs[2]); // Switch mobile active column to Done
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('kanban-column-DONE').className).toContain('flex');
    expect(screen.getByTestId('kanban-column-TODO').className).toContain('hidden md:flex');
  });
});
