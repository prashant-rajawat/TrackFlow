// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { IssueForm } from '../../src/components/issues/IssueForm';
import { CreateIssueModal } from '../../src/components/issues/CreateIssueModal';
import { IssueList } from '../../src/components/issues/IssueList';
import { IssueDetailsPanel } from '../../src/components/issues/IssueDetailsPanel';
import { DeleteIssueDialog } from '../../src/components/issues/DeleteIssueDialog';
import { IssuesPage } from '../../src/pages/issues/IssuesPage';
import { ToastProvider } from '../../src/context/ToastContext';
import * as WorkspaceContextModule from '../../src/context/WorkspaceContext';
import { projectService } from '../../src/services/project.service';
import { issueService } from '../../src/services/issue.service';
import { Project, ProjectMember } from '../../src/types/project';
import { Issue, IssuePermissions } from '../../src/types/issue';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockProject: Project = {
  id: 'proj_1',
  name: 'Mobile Core',
  key: 'MOB',
  description: 'Mobile API gateway',
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

const mockIssue: Issue = {
  id: 'iss_1',
  title: 'Auth cookie dropped on reload',
  description: 'Steps to reproduce cookie drop.',
  issueKey: 'MOB-1',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  reporterId: 'usr_1',
  assigneeId: 'usr_2',
  type: 'BUG',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2027-02-01T00:00:00.000Z',
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  reporter: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
  assignee: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
  project: { id: 'proj_1', name: 'Mobile Core', key: 'MOB', workspaceId: 'ws_1' },
};

const adminPerms: IssuePermissions = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canAssign: true,
  canUpdateStatus: true,
  canUpdatePriority: true,
  canDelete: true,
};

const devPerms: IssuePermissions = { ...adminPerms, canDelete: false };

const viewerPerms: IssuePermissions = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canAssign: false,
  canUpdateStatus: false,
  canUpdatePriority: false,
  canDelete: false,
};

describe('TrackFlow Phase 4: Frontend Issue Management Components', () => {
  it('validates required title and description in IssueForm before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<IssueForm mode="create" projectMembers={mockMembers} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create issue/i }));

    expect(await screen.findByText(/issue title is required/i)).toBeTruthy();
    expect(screen.getByText(/issue description is required/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    // Short title check
    await user.type(screen.getByLabelText(/issue title/i), 'ab');
    await user.type(screen.getByLabelText(/description/i), 'Valid details');
    await user.click(screen.getByRole('button', { name: /create issue/i }));
    expect(await screen.findByText(/must be at least 3 characters/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid IssueForm payload including assignee selection and disables inputs while submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <IssueForm mode="create" projectMembers={mockMembers} isSubmitting={false} onSubmit={onSubmit} />
    );

    await user.type(screen.getByLabelText(/issue title/i), 'Fix SSO callback');
    await user.type(screen.getByLabelText(/description/i), 'Handle state mismatch gracefully.');
    await user.selectOptions(screen.getByLabelText(/type/i), 'FEATURE');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'CRITICAL');
    await user.selectOptions(screen.getByLabelText(/assignee/i), 'usr_2');
    await user.click(screen.getByRole('button', { name: /create issue/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Fix SSO callback',
        description: 'Handle state mismatch gracefully.',
        type: 'FEATURE',
        priority: 'CRITICAL',
        status: 'TODO',
        assigneeId: 'usr_2',
        dueDate: null,
      });
    });

    rerender(
      <IssueForm mode="create" projectMembers={mockMembers} isSubmitting={true} onSubmit={onSubmit} />
    );
    expect((screen.getByLabelText(/issue title/i) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /create issue/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays API errors cleanly in CreateIssueModal and calls onIssueCreated on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onIssueCreated = vi.fn();

    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);
    const createSpy = vi
      .spyOn(issueService, 'createIssue')
      .mockRejectedValueOnce(new Error('Assignee must be a project member'))
      .mockResolvedValueOnce({ issue: mockIssue, permissions: adminPerms });

    render(
      <ToastProvider>
        <CreateIssueModal
          isOpen={true}
          project={mockProject}
          onClose={onClose}
          onIssueCreated={onIssueCreated}
        />
      </ToastProvider>
    );

    await user.type(screen.getByLabelText(/issue title/i), 'Auth cookie dropped on reload');
    await user.type(screen.getByLabelText(/description/i), 'Steps to reproduce cookie drop.');
    await user.click(screen.getByRole('button', { name: /create issue/i }));

    const errMatches = await screen.findAllByText(/assignee must be a project member/i);
    expect(errMatches.length).toBeGreaterThanOrEqual(1);
    expect(onClose).not.toHaveBeenCalled();

    // Retry succeeds
    await user.click(screen.getByRole('button', { name: /create issue/i }));
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(onIssueCreated).toHaveBeenCalledWith(mockIssue);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders IssueList empty state, error retry state, and row navigation click', async () => {
    const user = userEvent.setup();
    const onSelectIssue = vi.fn();
    const onCreateIssue = vi.fn();
    const onRetry = vi.fn();

    const { rerender, container } = render(
      <IssueList
        issues={[]}
        isLoading={true}
        onSelectIssue={onSelectIssue}
      />
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    rerender(
      <IssueList
        issues={[]}
        isLoading={false}
        error="Network timeout"
        onRetry={onRetry}
        onSelectIssue={onSelectIssue}
      />
    );
    expect(screen.getByText(/network timeout/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();

    rerender(
      <IssueList
        issues={[]}
        isLoading={false}
        canCreate={true}
        onCreateIssue={onCreateIssue}
        onSelectIssue={onSelectIssue}
      />
    );
    expect(screen.getByText(/no issues filed yet/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /create issue/i }));
    expect(onCreateIssue).toHaveBeenCalled();

    rerender(
      <IssueList
        issues={[mockIssue]}
        isLoading={false}
        canDelete={true}
        onSelectIssue={onSelectIssue}
        onRequestDelete={vi.fn()}
      />
    );
    expect(screen.getAllByText('MOB-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alice Admin').length).toBeGreaterThan(0);
    await user.click(screen.getAllByText('Auth cookie dropped on reload')[0]);
    expect(onSelectIssue).toHaveBeenCalledWith(mockIssue);
  });

  it('renders IssueDetailsPanel with permission-based control visibility for Viewer, Developer, and Project Admin', async () => {
    const user = userEvent.setup();
    const onUpdateIssue = vi.fn().mockResolvedValue(undefined);
    const onQuickStatusChange = vi.fn().mockResolvedValue(undefined);
    const onRequestDelete = vi.fn();

    // Viewer: read-only, no Edit button, no Delete button, no status/priority/assignee selects
    const { rerender } = render(
      <IssueDetailsPanel
        issue={mockIssue}
        permissions={viewerPerms}
        projectMembers={mockMembers}
        onUpdateIssue={onUpdateIssue}
        onQuickStatusChange={onQuickStatusChange}
        onQuickPriorityChange={vi.fn()}
        onQuickAssigneeChange={vi.fn()}
        onRequestDelete={onRequestDelete}
      />
    );
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    expect(screen.queryByLabelText(/issue status/i)).toBeNull();

    // Developer: shows Edit and selects, hides Delete
    rerender(
      <IssueDetailsPanel
        issue={mockIssue}
        permissions={devPerms}
        projectMembers={mockMembers}
        onUpdateIssue={onUpdateIssue}
        onQuickStatusChange={onQuickStatusChange}
        onQuickPriorityChange={vi.fn()}
        onQuickAssigneeChange={vi.fn()}
        onRequestDelete={onRequestDelete}
      />
    );
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();

    await user.selectOptions(screen.getByLabelText(/issue status/i), 'DONE');
    expect(onQuickStatusChange).toHaveBeenCalledWith('DONE');

    // Project Admin: shows Delete & allows inline edit submission
    rerender(
      <IssueDetailsPanel
        issue={mockIssue}
        permissions={adminPerms}
        projectMembers={mockMembers}
        onUpdateIssue={onUpdateIssue}
        onQuickStatusChange={onQuickStatusChange}
        onQuickPriorityChange={vi.fn()}
        onQuickAssigneeChange={vi.fn()}
        onRequestDelete={onRequestDelete}
      />
    );
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const titleInput = screen.getByLabelText(/issue title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Edited Issue Title');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(onUpdateIssue).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Edited Issue Title' })
      );
    });
  });

  it('renders DeleteIssueDialog confirmation details and triggers confirm callback', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteIssueDialog
        isOpen={true}
        issue={mockIssue}
        error="Permission denied"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('MOB-1')).toBeTruthy();
    expect(screen.getByText('Auth cookie dropped on reload')).toBeTruthy();
    expect(screen.getByText(/permission denied/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /delete issue/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('navigates to issue details from IssuesPage and renders onboarding empty state when no accessible projects exist', async () => {
    const user = userEvent.setup();

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

    vi.spyOn(issueService, 'listWorkspaceIssues')
      .mockResolvedValueOnce({ issues: [], projects: [] })
      .mockResolvedValueOnce({
        issues: [mockIssue],
        projects: [{ ...mockProject, currentUserProjectRole: 'PROJECT_ADMIN', issuePermissions: adminPerms }],
      });

    const { unmount } = render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/issues']}>
          <Routes>
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/projects/:projectId/issues/:issueId" element={<div>Issue Details Route Target</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText(/no accessible projects in this workspace/i)).toBeTruthy();
    unmount();

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/issues']}>
          <Routes>
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/projects/:projectId/issues/:issueId" element={<div>Issue Details Route Target</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    const rowTitle = await screen.findAllByText('Auth cookie dropped on reload');
    await user.click(rowTitle[0]);

    expect(await screen.findByText('Issue Details Route Target')).toBeTruthy();
  });
});
