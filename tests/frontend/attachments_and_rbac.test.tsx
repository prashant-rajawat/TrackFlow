// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AttachmentSection } from '../../src/components/attachments/AttachmentSection';
import { IssueDetailsPanel } from '../../src/components/issues/IssueDetailsPanel';
import { ProjectMembersTab } from '../../src/components/projects/ProjectMembersTab';
import { ProjectSettingsTab } from '../../src/components/projects/ProjectSettingsTab';
import { ToastProvider } from '../../src/context/ToastContext';
import { attachmentService } from '../../src/services/attachment.service';
import { commentService } from '../../src/services/comment.service';
import { projectService } from '../../src/services/project.service';
import { workspaceService } from '../../src/services/workspace.service';
import { Issue, IssuePermissions } from '../../src/types/issue';
import { AttachmentStorageStatus, IssueAttachment } from '../../src/types/attachment';
import { Project } from '../../src/types/project';

vi.mock('../../src/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: {
      id: 'ws_1',
      name: 'Acme Workspace',
      slug: 'acme-ws',
      ownerId: 'usr_admin',
      role: 'MEMBER',
    },
    workspaces: [],
    isLoading: false,
    setCurrentWorkspace: vi.fn(),
    refreshWorkspaces: vi.fn(),
  }),
}));

const devPermissions: IssuePermissions = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canAssign: true,
  canUpdateStatus: true,
  canUpdatePriority: true,
  canDelete: false,
  canViewComments: true,
  canCreateComment: true,
  canModerateComments: false,
  canViewAttachments: true,
  canUploadAttachments: true,
  canDeleteOwnAttachment: true,
  canDeleteAnyAttachment: false,
};

const adminPermissions: IssuePermissions = {
  ...devPermissions,
  canDelete: true,
  canModerateComments: true,
  canDeleteAnyAttachment: true,
};

const viewerPermissions: IssuePermissions = {
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

const healthyStorage: AttachmentStorageStatus = {
  provider: 'memory',
  configured: true,
  available: true,
  persistent: false,
};

const makeAttachment = (overrides: Partial<IssueAttachment> = {}): IssueAttachment => ({
  id: 'att_1',
  originalName: 'crash-log.txt',
  storageProvider: 'memory',
  mimeType: 'text/plain',
  sizeBytes: 2048,
  issueId: 'iss_1',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  uploadedBy: 'usr_dev1',
  uploader: {
    id: 'usr_dev1',
    fullName: 'Bob Dev',
    email: 'bob@acme.dev',
  },
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
  ...overrides,
});

const renderAttachmentSection = (
  props: Partial<React.ComponentProps<typeof AttachmentSection>> = {}
) =>
  render(
    <ToastProvider>
      <AttachmentSection
        issueId="iss_1"
        permissions={devPermissions}
        currentUserId="usr_dev1"
        {...props}
      />
    </ToastProvider>
  );

describe('TrackFlow Phase 8: Attachments & RBAC Frontend UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Renders loading skeleton, empty state, and storage-unavailable honest notice', async () => {
    let resolveList!: (val: any) => void;
    vi.spyOn(attachmentService, 'listIssueAttachments').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        })
    );

    renderAttachmentSection();
    expect(screen.getByLabelText('Loading attachments')).toBeTruthy();

    resolveList({
      attachments: [],
      storageStatus: {
        provider: 'unconfigured',
        configured: false,
        available: false,
        persistent: false,
        message: 'Production file storage is not configured.',
      },
      limits: {
        maxFileSizeBytes: 10 * 1024 * 1024,
        maxFilesPerRequest: 5,
        maxAttachmentsPerIssue: 20,
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt'],
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('No attachments yet')).toBeTruthy();
    });
    expect(screen.getByText('File storage unavailable')).toBeTruthy();
    const chooseBtn = screen.getByRole('button', { name: /Choose Files/i }) as HTMLButtonElement;
    expect(chooseBtn.disabled).toBe(true);
  });

  it('2. Rejects disallowed client file types, uploads with progress, and retries failed upload preserving Idempotency-Key', async () => {
    vi.spyOn(attachmentService, 'listIssueAttachments').mockResolvedValue({
      attachments: [],
      storageStatus: healthyStorage,
      limits: {
        maxFileSizeBytes: 10 * 1024 * 1024,
        maxFilesPerRequest: 5,
        maxAttachmentsPerIssue: 20,
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt'],
        allowedMimeTypes: ['image/png'],
      },
    });

    const seenKeys: string[] = [];
    const uploadSpy = vi
      .spyOn(attachmentService, 'uploadIssueAttachments')
      .mockImplementationOnce(async (_issueId, _files, opts) => {
        if (opts?.idempotencyKey) seenKeys.push(opts.idempotencyKey);
        opts?.onProgress?.(60);
        throw new Error('Temporary network interruption');
      })
      .mockImplementationOnce(async (_issueId, _files, opts) => {
        if (opts?.idempotencyKey) seenKeys.push(opts.idempotencyKey);
        opts?.onProgress?.(100);
        return {
          attachments: [makeAttachment({ id: 'att_new', originalName: 'trace.txt' })],
          storageStatus: healthyStorage,
          idempotentReplay: false,
        };
      });

    renderAttachmentSection();
    await waitFor(() => expect(screen.getByText('No attachments yet')).toBeTruthy());

    const input = screen.getByLabelText('Choose attachment files') as HTMLInputElement;

    // Invalid SVG should be blocked before calling uploadIssueAttachments
    const badFile = new File(['<svg></svg>'], 'evil.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(await screen.findByText(/not a supported file type/i)).toBeTruthy();
    expect(uploadSpy).not.toHaveBeenCalled();

    // Valid TXT triggers upload -> fails -> exposes Retry Upload with same Idempotency-Key
    const goodFile = new File(['error line 1'], 'trace.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [goodFile] } });

    const errs = await screen.findAllByText('Temporary network interruption');
    expect(errs.length).toBeGreaterThanOrEqual(1);
    const retryBtn = screen.getByRole('button', { name: /Retry Upload/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('trace.txt')).toBeTruthy();
    });
    expect(seenKeys).toHaveLength(2);
    expect(seenKeys[0]).toBe(seenKeys[1]);
  });

  it('3. Previews text safely, triggers download, and enforces own/admin/viewer delete RBAC', async () => {
    const ownAtt = makeAttachment({
      id: 'att_own',
      originalName: 'my-log.txt',
      uploadedBy: 'usr_dev1',
    });
    const otherAtt = makeAttachment({
      id: 'att_other',
      originalName: 'other-log.txt',
      uploadedBy: 'usr_dev2',
      uploader: { id: 'usr_dev2', fullName: 'Charlie Dev', email: 'charlie@acme.dev' },
    });
    const docxAtt = makeAttachment({
      id: 'att_docx',
      originalName: 'architecture-spec.docx',
      fileExtension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedBy: 'usr_dev2',
      uploader: { id: 'usr_dev2', fullName: 'Charlie Dev', email: 'charlie@acme.dev' },
    });

    vi.spyOn(attachmentService, 'listIssueAttachments').mockResolvedValue({
      attachments: [ownAtt, otherAtt, docxAtt],
      storageStatus: healthyStorage,
      limits: {
        maxFileSizeBytes: 10 * 1024 * 1024,
        maxFilesPerRequest: 5,
        maxAttachmentsPerIssue: 20,
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt', '.csv', '.docx', '.xlsx'],
        allowedMimeTypes: ['text/plain'],
      },
    });
    vi.spyOn(attachmentService, 'fetchAttachmentText').mockResolvedValue(
      '<script>alert(1)</script> plain text log'
    );
    const dlSpy = vi
      .spyOn(attachmentService, 'triggerAttachmentDownload')
      .mockResolvedValue(undefined);
    const delSpy = vi
      .spyOn(attachmentService, 'deleteAttachment')
      .mockResolvedValue({ deletedId: 'att_own', storageCleanupDeferred: false });

    // Developer: can delete own, CANNOT delete other's
    renderAttachmentSection({ permissions: devPermissions, currentUserId: 'usr_dev1' });

    await waitFor(() => expect(screen.getByText('my-log.txt')).toBeTruthy());
    expect(screen.getByText('architecture-spec.docx')).toBeTruthy();
    expect(screen.queryByLabelText('Preview architecture-spec.docx')).toBeNull();
    expect(screen.getByLabelText('Download architecture-spec.docx')).toBeTruthy();
    expect(screen.getByLabelText('Delete my-log.txt')).toBeTruthy();
    expect(screen.queryByLabelText('Delete other-log.txt')).toBeNull();

    // Preview text safely
    await userEvent.click(screen.getByLabelText('Preview my-log.txt'));
    const preContent = await screen.findByText(/<script>alert\(1\)<\/script> plain text log/);
    expect(preContent.tagName).toBe('PRE');
    await userEvent.click(screen.getByLabelText('Close attachment preview'));

    // Download triggers service
    await userEvent.click(screen.getByLabelText('Download my-log.txt'));
    expect(dlSpy).toHaveBeenCalledWith('att_own', 'my-log.txt');

    // Confirm delete dialog
    await userEvent.click(screen.getByLabelText('Delete my-log.txt'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Attachment' }));
    await waitFor(() => expect(delSpy).toHaveBeenCalledWith('att_own'));
    expect(screen.queryByText('my-log.txt')).toBeNull();

    // PROJECT_ADMIN sees delete on other user's attachment
    cleanup();
    renderAttachmentSection({ permissions: adminPermissions, currentUserId: 'usr_admin' });
    await waitFor(() => expect(screen.getByLabelText('Delete other-log.txt')).toBeTruthy());

    // VIEWER sees read-only notice, no Choose Files, and no Delete buttons
    cleanup();
    renderAttachmentSection({ permissions: viewerPermissions, currentUserId: 'usr_viewer' });
    await waitFor(() => expect(screen.getByText('my-log.txt')).toBeTruthy());
    expect(
      screen.getByText(/Read-only access: viewers can inspect and download attachments/i)
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Choose Files/i })).toBeNull();
    expect(screen.queryByLabelText('Delete my-log.txt')).toBeNull();
  });

  it('4. Renders read-only viewer notice & AttachmentSection inside IssueDetailsPanel', async () => {
    vi.spyOn(attachmentService, 'listIssueAttachments').mockResolvedValue({
      attachments: [],
      storageStatus: healthyStorage,
      limits: {
        maxFileSizeBytes: 10 * 1024 * 1024,
        maxFilesPerRequest: 5,
        maxAttachmentsPerIssue: 20,
        allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt'],
        allowedMimeTypes: ['text/plain'],
      },
    });
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [],
      totalCount: 0,
      activeCount: 0,
      topLevelCount: 0,
      hasMore: false,
      permissions: viewerPermissions,
    });

    const sampleIssue: Issue = {
      id: 'iss_1',
      title: 'Viewer Test Issue',
      description: 'Checking read-only viewer panel rendering.',
      issueKey: 'CORE-1',
      projectId: 'proj_1',
      workspaceId: 'ws_1',
      reporterId: 'usr_admin',
      assigneeId: null,
      type: 'BUG',
      priority: 'MEDIUM',
      status: 'TODO',
      createdAt: '2026-11-17T10:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
    };

    render(
      <MemoryRouter>
        <ToastProvider>
          <IssueDetailsPanel
            issue={sampleIssue}
            permissions={viewerPermissions}
            projectMembers={[]}
            currentUserId="usr_viewer"
            onUpdateIssue={vi.fn()}
            onQuickStatusChange={vi.fn()}
            onQuickPriorityChange={vi.fn()}
            onQuickAssigneeChange={vi.fn()}
            onRequestDelete={vi.fn()}
          />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        /Read-only viewer access: you can view issue details, download attachments, and read comments/i
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    await waitFor(() => expect(screen.getByText('Attachments')).toBeTruthy());
  });

  it('5. Enforces RBAC in ProjectMembersTab and ProjectSettingsTab without window.confirm', async () => {
    vi.spyOn(projectService, 'listProjectMembers').mockResolvedValue([
      {
        id: 'pm_1',
        projectId: 'proj_1',
        workspaceId: 'ws_1',
        userId: 'usr_dev1',
        role: 'DEVELOPER',
        joinedAt: '2026-11-17T00:00:00.000Z',
        createdAt: '2026-11-17T00:00:00.000Z',
        updatedAt: '2026-11-17T00:00:00.000Z',
        user: { id: 'usr_dev1', fullName: 'Bob Dev', email: 'bob@acme.dev' },
      },
    ]);
    vi.spyOn(workspaceService, 'listMembers').mockResolvedValue([]);

    const viewerProject: Project = {
      id: 'proj_1',
      name: 'Core Platform',
      key: 'CORE',
      description: 'Core services',
      workspaceId: 'ws_1',
      createdBy: 'usr_admin',
      status: 'ACTIVE',
      visibility: 'WORKSPACE',
      color: 'blue',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      currentUserProjectRole: 'VIEWER',
      projectPermissions: {
        canView: true,
        canUpdate: false,
        canArchiveRestore: false,
        canDelete: false,
        canManageMembers: false,
      },
    };

    render(
      <MemoryRouter>
        <ToastProvider>
          <ProjectMembersTab project={viewerProject} />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Bob Dev')).toBeTruthy());
    expect(screen.getByText(/Read-only membership view/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Member/i })).toBeNull();
    expect(screen.queryByLabelText(/Remove Bob Dev/i)).toBeNull();

    // Check ProjectSettingsTab for VIEWER
    cleanup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProjectSettingsTab project={viewerProject} onProjectUpdated={vi.fn()} />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Read-only project settings/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archive/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete Project/i })).toBeNull();
  });
});
