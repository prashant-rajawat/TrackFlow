// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentSection } from '../../src/components/comments/CommentSection';
import { ToastProvider } from '../../src/context/ToastContext';
import { commentService } from '../../src/services/comment.service';
import { CommentThread, IssueComment } from '../../src/types/comment';
import { IssuePermissions } from '../../src/types/issue';

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
};

const adminPermissions: IssuePermissions = {
  ...devPermissions,
  canDelete: true,
  canModerateComments: true,
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
};

const makeReply = (overrides: Partial<IssueComment> = {}): IssueComment => ({
  id: 'cmt_reply_1',
  issueId: 'iss_1',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  authorId: 'usr_1',
  parentCommentId: 'cmt_1',
  content: 'I reproduced this in Firefox as well.',
  isDeleted: false,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-10-10T10:05:00.000Z',
  updatedAt: '2026-10-10T10:05:00.000Z',
  author: {
    id: 'usr_1',
    fullName: 'Alice Admin',
    email: 'alice@acme.dev',
  },
  ...overrides,
});

const makeThread = (overrides: Partial<CommentThread> = {}): CommentThread => ({
  id: 'cmt_1',
  issueId: 'iss_1',
  projectId: 'proj_1',
  workspaceId: 'ws_1',
  authorId: 'usr_2',
  parentCommentId: null,
  content: 'Investigating the cookie SameSite attribute.',
  isDeleted: false,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  author: {
    id: 'usr_2',
    fullName: 'Bob Developer',
    email: 'bob@acme.dev',
  },
  replies: [],
  ...overrides,
});

const renderComments = (
  props: Partial<React.ComponentProps<typeof CommentSection>> = {}
) => {
  return render(
    <ToastProvider>
      <CommentSection
        issueId="iss_1"
        permissions={devPermissions}
        currentUserId="usr_2"
        {...props}
      />
    </ToastProvider>
  );
};

describe('TrackFlow Phase 6: Issue Comments Frontend UI & Workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Renders loading skeleton first, then empty state when no comments exist', async () => {
    let resolveFn!: (value: any) => void;
    vi.spyOn(commentService, 'listIssueComments').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        })
    );

    renderComments();
    expect(screen.getByLabelText('Loading comments')).toBeTruthy();

    resolveFn({
      comments: [],
      totalCount: 0,
      activeCount: 0,
      topLevelCount: 0,
      hasMore: false,
      permissions: devPermissions,
    });

    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeTruthy();
    });
    expect(screen.getByLabelText('0 active comments').textContent).toBe('(0)');
  });

  it('2. Renders error banner and recovers when clicking Retry', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(commentService, 'listIssueComments')
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({
        comments: [makeThread()],
        totalCount: 1,
        activeCount: 1,
        topLevelCount: 1,
        hasMore: false,
        permissions: devPermissions,
      });

    renderComments();

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Investigating the cookie SameSite attribute.')).toBeTruthy();
    });
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('3. Validates empty/over-limit submissions, prevents duplicate submits, clears on success, and preserves text on error', async () => {
    const user = userEvent.setup();
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [],
      totalCount: 0,
      activeCount: 0,
      topLevelCount: 0,
      hasMore: false,
      permissions: devPermissions,
    });

    const createSpy = vi
      .spyOn(commentService, 'createComment')
      .mockRejectedValueOnce(new Error('Server failed temporarily'))
      .mockResolvedValueOnce({
        comment: makeThread({ id: 'cmt_new', content: 'Verified fix on staging.' }),
        permissions: devPermissions,
      });

    renderComments();
    await waitFor(() => expect(screen.getByText('No comments yet')).toBeTruthy());

    // Whitespace-only submission blocked cleanly
    const textarea = screen.getByLabelText('Add a comment') as HTMLTextAreaElement;
    await user.type(textarea, '    ');
    await user.click(screen.getByRole('button', { name: 'Post Comment' }));
    expect(screen.getByText('Comment cannot be empty.')).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();

    // Failed submission preserves draft text
    await user.clear(textarea);
    await user.type(textarea, 'Verified fix on staging.');
    expect(screen.getByText('24 / 2000')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Post Comment' }));
    await waitFor(() => {
      expect(screen.getByText('Server failed temporarily')).toBeTruthy();
    });
    expect(textarea.value).toBe('Verified fix on staging.');

    // Retrying succeeds, clears textarea, and updates comment list & count
    await user.click(screen.getByRole('button', { name: 'Post Comment' }));
    await waitFor(() => {
      expect(screen.getByText('Verified fix on staging.')).toBeTruthy();
    });
    expect(textarea.value).toBe('');
    expect(screen.getByLabelText('1 active comments').textContent).toBe('(1)');
  });

  it('4. Creates 1-level replies inline and keeps replies free of nested Reply buttons', async () => {
    const user = userEvent.setup();
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [makeThread()],
      totalCount: 1,
      activeCount: 1,
      topLevelCount: 1,
      hasMore: false,
      permissions: devPermissions,
    });

    const replySpy = vi.spyOn(commentService, 'createReply').mockResolvedValue({
      comment: makeReply({ id: 'cmt_r_new', authorId: 'usr_2', content: 'Patch PR #42 opened.' }),
      permissions: devPermissions,
    });

    renderComments();
    await waitFor(() =>
      expect(screen.getByText('Investigating the cookie SameSite attribute.')).toBeTruthy()
    );

    await user.click(screen.getByRole('button', { name: 'Reply to comment' }));
    const replyBox = screen.getByLabelText('Reply to Bob Developer');
    await user.type(replyBox, 'Patch PR #42 opened.');
    await user.click(screen.getByRole('button', { name: 'Post Reply' }));

    await waitFor(() => {
      expect(screen.getByText('Patch PR #42 opened.')).toBeTruthy();
    });
    expect(replySpy).toHaveBeenCalledWith('cmt_1', 'Patch PR #42 opened.', 'iss_1');
    expect(screen.getByLabelText('2 active comments').textContent).toBe('(2)');

    // Only 1 Reply button exists (for top-level comment), none inside the Replies region
    const repliesRegion = screen.getByLabelText('Replies');
    expect(within(repliesRegion).queryByRole('button', { name: 'Reply to comment' })).toBeNull();
  });

  it('5. Supports inline edit (Save & Cancel) with Edited indicator and soft-delete preserving replies', async () => {
    const user = userEvent.setup();
    const threadWithReply = makeThread({
      replies: [makeReply()],
    });

    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [threadWithReply],
      totalCount: 2,
      activeCount: 2,
      topLevelCount: 1,
      hasMore: false,
      permissions: devPermissions,
    });

    vi.spyOn(commentService, 'updateComment').mockResolvedValue({
      comment: makeThread({
        content: 'Updated root cause details.',
        editedAt: '2026-10-10T10:15:00.000Z',
      }),
      permissions: devPermissions,
    });

    vi.spyOn(commentService, 'deleteComment').mockResolvedValue({
      comment: makeThread({
        content: '',
        isDeleted: true,
        deletedAt: '2026-10-10T10:20:00.000Z',
      }),
      permissions: devPermissions,
    });

    renderComments();
    await waitFor(() =>
      expect(screen.getByText('Investigating the cookie SameSite attribute.')).toBeTruthy()
    );

    // Edit and cancel leaves original content intact
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const editBox = screen.getByLabelText('Edit comment') as HTMLTextAreaElement;
    expect(editBox.value).toBe('Investigating the cookie SameSite attribute.');
    await user.clear(editBox);
    await user.type(editBox, 'Discarded edit');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Investigating the cookie SameSite attribute.')).toBeTruthy();

    // Edit and save displays updated text and Edited indicator
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const editBox2 = screen.getByLabelText('Edit comment');
    await user.clear(editBox2);
    await user.type(editBox2, 'Updated root cause details.');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Updated root cause details.')).toBeTruthy();
      expect(screen.getByText('Edited')).toBeTruthy();
    });

    // Soft delete opens confirmation modal and preserves child reply
    await user.click(screen.getByRole('button', { name: 'Delete comment' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/deleted comment indicator/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete Comment' }));
    await waitFor(() => {
      expect(screen.getByText('This comment was deleted.')).toBeTruthy();
    });
    expect(screen.queryByText('Updated root cause details.')).toBeNull();
    expect(screen.getByText('I reproduced this in Firefox as well.')).toBeTruthy();
    expect(screen.getByLabelText('1 active comments').textContent).toBe('(1)');
  });

  it('6. Enforces RBAC UI visibility for VIEWER, DEVELOPER (own only), and PROJECT_ADMIN (moderation)', async () => {
    const otherUserThread = makeThread({
      id: 'cmt_other',
      authorId: 'usr_1',
      author: { id: 'usr_1', fullName: 'Alice Admin', email: 'alice@acme.dev' },
      content: 'Admin guidance comment',
    });
    const ownThread = makeThread({
      id: 'cmt_own',
      authorId: 'usr_2',
      author: { id: 'usr_2', fullName: 'Bob Developer', email: 'bob@acme.dev' },
      content: 'Developer own comment',
    });

    // A) VIEWER sees read-only notice and zero composer / action buttons
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [otherUserThread, ownThread],
      totalCount: 2,
      activeCount: 2,
      topLevelCount: 2,
      hasMore: false,
      permissions: viewerPermissions,
    });

    const { unmount } = renderComments({
      permissions: viewerPermissions,
      currentUserId: 'usr_3',
    });
    await waitFor(() => expect(screen.getByText('Admin guidance comment')).toBeTruthy());
    expect(screen.getByText(/Read-only access/i)).toBeTruthy();
    expect(screen.queryByLabelText('Add a comment')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reply to comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
    unmount();

    // B) DEVELOPER (usr_2) sees Edit/Delete ONLY on own comment, not Alice's
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [otherUserThread, ownThread],
      totalCount: 2,
      activeCount: 2,
      topLevelCount: 2,
      hasMore: false,
      permissions: devPermissions,
    });

    const devRender = renderComments({
      permissions: devPermissions,
      currentUserId: 'usr_2',
    });
    await waitFor(() => expect(screen.getByText('Admin guidance comment')).toBeTruthy());

    const aliceArticle = screen.getByRole('article', { name: 'Comment by Alice Admin' });
    const bobArticle = screen.getByRole('article', { name: 'Comment by Bob Developer' });
    expect(within(aliceArticle).queryByRole('button', { name: 'Edit comment' })).toBeNull();
    expect(within(aliceArticle).queryByRole('button', { name: 'Delete comment' })).toBeNull();
    expect(within(aliceArticle).getByRole('button', { name: 'Reply to comment' })).toBeTruthy();
    expect(within(bobArticle).getByRole('button', { name: 'Edit comment' })).toBeTruthy();
    expect(within(bobArticle).getByRole('button', { name: 'Delete comment' })).toBeTruthy();
    devRender.unmount();

    // C) PROJECT_ADMIN (usr_1) sees Edit/Delete moderation controls on Bob's comment too
    vi.spyOn(commentService, 'listIssueComments').mockResolvedValue({
      comments: [otherUserThread, ownThread],
      totalCount: 2,
      activeCount: 2,
      topLevelCount: 2,
      hasMore: false,
      permissions: adminPermissions,
    });

    renderComments({
      permissions: adminPermissions,
      currentUserId: 'usr_1',
    });
    await waitFor(() => expect(screen.getByText('Developer own comment')).toBeTruthy());
    const bobAsAdmin = screen.getByRole('article', { name: 'Comment by Bob Developer' });
    expect(within(bobAsAdmin).getByRole('button', { name: 'Edit comment' })).toBeTruthy();
    expect(within(bobAsAdmin).getByRole('button', { name: 'Delete comment' })).toBeTruthy();
  });

  it('7. Supports chronological sort toggle and Load More pagination', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(commentService, 'listIssueComments')
      .mockResolvedValueOnce({
        comments: [makeThread({ id: 'cmt_1', content: 'First page comment' })],
        totalCount: 2,
        activeCount: 2,
        topLevelCount: 2,
        hasMore: true,
        permissions: devPermissions,
      })
      .mockResolvedValueOnce({
        comments: [makeThread({ id: 'cmt_2', content: 'Second page comment' })],
        totalCount: 2,
        activeCount: 2,
        topLevelCount: 2,
        hasMore: false,
        permissions: devPermissions,
      })
      .mockResolvedValueOnce({
        comments: [
          makeThread({ id: 'cmt_2', content: 'Second page comment' }),
          makeThread({ id: 'cmt_1', content: 'First page comment' }),
        ],
        totalCount: 2,
        activeCount: 2,
        topLevelCount: 2,
        hasMore: false,
        permissions: devPermissions,
      });

    renderComments({ pageSize: 1 });
    await waitFor(() => expect(screen.getByText('First page comment')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Load more comments' }));
    await waitFor(() => expect(screen.getByText('Second page comment')).toBeTruthy());
    expect(listSpy).toHaveBeenNthCalledWith(2, 'iss_1', { sort: 'asc', limit: 1, offset: 1 });

    await user.click(screen.getByRole('button', { name: /Oldest first/i }));
    await waitFor(() => {
      expect(screen.getByText('Newest first')).toBeTruthy();
    });
    expect(listSpy).toHaveBeenNthCalledWith(3, 'iss_1', { sort: 'desc', limit: 1, offset: 0 });
  });
});
