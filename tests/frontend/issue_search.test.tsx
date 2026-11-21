// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { IssuesPage } from '../../src/pages/issues/IssuesPage';
import { ProjectDetailsPage } from '../../src/pages/projects/ProjectDetailsPage';
import { ToastProvider } from '../../src/context/ToastContext';
import * as WorkspaceContextModule from '../../src/context/WorkspaceContext';
import { issueService } from '../../src/services/issue.service';
import { projectService } from '../../src/services/project.service';
import { Project, ProjectMember } from '../../src/types/project';
import { Issue, IssuePermissions, ProjectWithIssuePermissions } from '../../src/types/issue';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const adminPerms: IssuePermissions = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canAssign: true,
  canUpdateStatus: true,
  canUpdatePriority: true,
  canDelete: true,
};

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
  issueCount: 2,
  memberCount: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const mockProjectsWithPerms: ProjectWithIssuePermissions[] = [
  { ...mockProject, currentUserProjectRole: 'PROJECT_ADMIN', issuePermissions: adminPerms },
  {
    ...mockProject,
    id: 'proj_2',
    name: 'Public API',
    key: 'API',
    currentUserProjectRole: 'DEVELOPER',
    issuePermissions: { ...adminPerms, canDelete: false },
  },
];

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

const issueOne: Issue = {
  id: 'iss_1',
  title: 'Auth cookie dropped on reload',
  description: 'Cookie lost after refresh',
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

const issueTwo: Issue = {
  id: 'iss_2',
  title: 'Rate limit response headers',
  description: 'Add remaining quota header',
  issueKey: 'API-1',
  projectId: 'proj_2',
  workspaceId: 'ws_1',
  reporterId: 'usr_2',
  assigneeId: null,
  type: 'FEATURE',
  priority: 'LOW',
  status: 'IN_PROGRESS',
  dueDate: null,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-08T00:00:00.000Z',
  reporter: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
  assignee: null,
  project: { id: 'proj_2', name: 'Public API', key: 'API', workspaceId: 'ws_1' },
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

describe('TrackFlow Phase 7: Frontend Issue Search, Filtering, Sorting & Pagination', () => {
  it('debounces search input, sends search query, clears search, and shows search empty state when 0 results', async () => {
    mockWorkspaceContext();
    const user = userEvent.setup();

    const listSpy = vi
      .spyOn(issueService, 'listWorkspaceIssues')
      .mockImplementation(async (_wsId, query) => {
        const q = typeof query === 'object' ? query : {};
        if (q.search === 'nonexistent') {
          return {
            issues: [],
            projects: mockProjectsWithPerms,
            members: mockMembers.map((m) => m.user!),
            pagination: {
              currentPage: 1,
              pageSize: 20,
              totalItems: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
        const filtered =
          q.search === 'cookie' ? [issueOne] : [issueOne, issueTwo];
        return {
          issues: filtered,
          projects: mockProjectsWithPerms,
          members: mockMembers.map((m) => m.user!),
          pagination: {
            currentPage: 1,
            pageSize: 20,
            totalItems: filtered.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/issues']}>
          <Routes>
            <Route path="/issues" element={<IssuesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText(/showing/i)).toBeTruthy();
    expect(screen.getAllByText('MOB-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('API-1').length).toBeGreaterThan(0);

    const searchInput = screen.getByRole('searchbox', { name: /search issues/i });
    await user.type(searchInput, 'cookie');

    await waitFor(
      () => {
        expect(listSpy).toHaveBeenCalledWith(
          'ws_1',
          expect.objectContaining({ search: 'cookie', page: 1 }),
          expect.anything()
        );
      },
      { timeout: 1500 }
    );

    expect(screen.queryByText('API-1')).toBeNull();

    // Type query returning 0 matches -> distinct IssueSearchEmptyState
    await user.clear(searchInput);
    await user.type(searchInput, 'nonexistent');

    expect(await screen.findByText(/no matching issues found/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /reset search & filters/i }));

    await waitFor(() => {
      expect(screen.getAllByText('API-1').length).toBeGreaterThan(0);
    });
  });

  it('toggles multi-value filters, removes individual active chips, resets filters, and triggers sort & pagination', async () => {
    mockWorkspaceContext();
    const user = userEvent.setup();

    const listSpy = vi
      .spyOn(issueService, 'listWorkspaceIssues')
      .mockImplementation(async (_wsId, query) => {
        const q = typeof query === 'object' ? query : {};
        return {
          issues: q.page === 2 ? [issueTwo] : [issueOne],
          projects: mockProjectsWithPerms,
          members: mockMembers.map((m) => m.user!),
          pagination: {
            currentPage: q.page || 1,
            pageSize: q.limit || 20,
            totalItems: 25,
            totalPages: 2,
            hasNextPage: (q.page || 1) < 2,
            hasPreviousPage: (q.page || 1) > 1,
          },
        };
      });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/issues']}>
          <Routes>
            <Route path="/issues" element={<IssuesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findAllByText('MOB-1');

    // Open filter panel
    await user.click(screen.getByRole('button', { name: /toggle issue filters/i }));
    await user.click(screen.getByRole('button', { name: /^To Do$/i }));
    await user.click(screen.getByRole('button', { name: /^Critical$/i }));
    await user.click(screen.getByRole('checkbox', { name: /unassigned/i }));

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({
          status: ['TODO'],
          priority: ['CRITICAL'],
          assigneeId: ['UNASSIGNED'],
          page: 1,
        }),
        expect.anything()
      );
    });

    // Active filter chips count = 3
    expect(screen.getByTestId('active-filter-count').textContent).toBe('3');
    expect(screen.getByRole('button', { name: /remove status: to do/i })).toBeTruthy();

    // Remove single chip
    await user.click(screen.getByRole('button', { name: /remove status: to do/i }));
    await waitFor(() => {
      expect(screen.getByTestId('active-filter-count').textContent).toBe('2');
    });

    // Sort change & asc/desc toggle
    await user.selectOptions(screen.getByLabelText(/sort issues by/i), 'priority');
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({ sortBy: 'priority', sortOrder: 'desc', page: 1 }),
        expect.anything()
      );
    });

    await user.click(screen.getByRole('button', { name: /sort descending/i }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({ sortBy: 'priority', sortOrder: 'asc', page: 1 }),
        expect.anything()
      );
    });

    // Pagination Next page & page size change
    await user.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({ page: 2 }),
        expect.anything()
      );
    });
    expect(await screen.findAllByText('API-1')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText(/rows per page/i), '50');
    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({ limit: 50, page: 1 }),
        expect.anything()
      );
    });

    // Reset all filters
    await user.click(screen.getAllByRole('button', { name: /reset filters/i })[0]);
    await waitFor(() => {
      expect(screen.queryByTestId('active-filter-count')).toBeNull();
    });
  });

  it('restores search, filters, sorting, and pagination from URL query parameters and sanitizes invalid params', async () => {
    mockWorkspaceContext();

    const listSpy = vi.spyOn(issueService, 'listWorkspaceIssues').mockResolvedValue({
      issues: [issueOne],
      projects: mockProjectsWithPerms,
      members: mockMembers.map((m) => m.user!),
      pagination: {
        currentPage: 2,
        pageSize: 10,
        totalItems: 15,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter
          initialEntries={[
            '/issues?search=cookie&status=TODO,BOGUS_STATUS&priority=HIGH&sortBy=priority&sortOrder=asc&page=2&limit=10',
          ]}
        >
          <Routes>
            <Route path="/issues" element={<IssuesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        'ws_1',
        expect.objectContaining({
          search: 'cookie',
          status: ['TODO'],
          priority: ['HIGH'],
          sortBy: 'priority',
          sortOrder: 'asc',
          page: 2,
          limit: 10,
        }),
        expect.anything()
      );
    });

    expect((screen.getByRole('searchbox', { name: /search issues/i }) as HTMLInputElement).value).toBe('cookie');
    expect((screen.getByLabelText(/sort issues by/i) as HTMLSelectElement).value).toBe('priority');
    expect(screen.getByText(/11–15/)).toBeTruthy();
  });

  it('renders error retry state and integrates discovery controls inside ProjectDetailsPage Issues tab', async () => {
    const user = userEvent.setup();
    vi.spyOn(projectService, 'getProject').mockResolvedValue(mockProject);
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue(mockMembers);

    const projIssuesSpy = vi
      .spyOn(issueService, 'listProjectIssues')
      .mockRejectedValueOnce(new Error('Temporary API error'))
      .mockResolvedValue({
        issues: [issueOne],
        project: mockProject,
        permissions: adminPerms,
        members: mockMembers.map((m) => m.user!),
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={['/projects/proj_1']}>
          <Routes>
            <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    );

    const issuesTab = await screen.findByRole('button', { name: /^issues\s*\(/i });
    await user.click(issuesTab);

    expect(await screen.findByText(/temporary api error/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findAllByText('MOB-1')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: /search issues/i })).toBeTruthy();

    // Verify dueDate filter works in project tab
    await user.click(screen.getByRole('button', { name: /toggle issue filters/i }));
    fireEvent.change(screen.getByLabelText(/due date filter/i), {
      target: { value: 'overdue' },
    });

    await waitFor(() => {
      expect(projIssuesSpy).toHaveBeenCalledWith(
        'proj_1',
        expect.objectContaining({ dueDatePreset: 'overdue', page: 1 }),
        expect.anything()
      );
    });
  });
});
