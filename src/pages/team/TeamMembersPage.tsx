import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Search,
  ExternalLink,
  LogOut,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { workspaceService } from '../../services/workspace.service';
import {
  WorkspaceMember,
  WorkspaceRole,
  Invitation,
} from '../../types/workspace';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/feedback/EmptyState';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';

export const TeamMembersPage: React.FC = () => {
  const { currentWorkspace, currentRole, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
  } | null>(null);

  // Leave & Remove Confirmation
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const canManageMembers = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const memberList = await workspaceService.listMembers(currentWorkspace.id);
      setMembers(memberList);

      if (canManageMembers) {
        const invList = await workspaceService.listInvitations(currentWorkspace.id);
        setInvitations(invList);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to load team data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, canManageMembers, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setIsInviting(true);
    try {
      const res = await workspaceService.createInvitation(currentWorkspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      addToast(
        res.emailSent ? 'Invitation email sent!' : 'Invitation link created successfully.',
        'success'
      );

      setInviteResult({
        inviteUrl: res.inviteUrl,
        emailSent: res.emailSent,
      });

      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to create invitation', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(id);
    addToast('Invitation link copied to clipboard', 'info');
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentWorkspace) return;
    try {
      await workspaceService.revokeInvitation(currentWorkspace.id, invitationId);
      addToast('Invitation revoked', 'info');
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: any) {
      addToast(err.message || 'Failed to revoke invitation', 'error');
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: WorkspaceRole) => {
    if (!currentWorkspace) return;
    try {
      const updated = await workspaceService.updateMemberRole(
        currentWorkspace.id,
        targetUserId,
        newRole
      );
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? updated : m))
      );
      addToast(`Member role updated to ${newRole}`, 'success');
      refreshWorkspaces();
    } catch (err: any) {
      addToast(err.message || 'Failed to change role', 'error');
    }
  };

  const handleConfirmRemove = async () => {
    if (!currentWorkspace || !memberToRemove) return;
    setIsRemoving(true);
    try {
      await workspaceService.removeMember(currentWorkspace.id, memberToRemove.userId);
      addToast('Member removed from workspace', 'success');
      setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
      setMemberToRemove(null);
      refreshWorkspaces();
    } catch (err: any) {
      addToast(err.message || 'Failed to remove member', 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!currentWorkspace) return;
    setIsLeaving(true);
    try {
      await workspaceService.leaveWorkspace(currentWorkspace.id);
      addToast('You have left the workspace', 'info');
      refreshWorkspaces();
    } catch (err: any) {
      addToast(err.message || 'Failed to leave workspace', 'error');
    } finally {
      setIsLeaving(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="No active workspace"
        description="Select or create a workspace to view and manage team members."
      />
    );
  }

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const name = m.user?.fullName?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <span>Workspace Members</span>
            <span aria-hidden="true">·</span>
            <span>{currentWorkspace.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Team & Permissions
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage who has access to {currentWorkspace.name} and configure their workspace roles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManageMembers && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                setInviteResult(null);
                setInviteEmail('');
                setInviteRole('MEMBER');
                setInviteModalOpen(true);
              }}
            >
              Invite Member
            </Button>
          )}

          {currentRole !== 'OWNER' && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={handleLeaveWorkspace}
              isLoading={isLeaving}
            >
              Leave Workspace
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === 'members'
              ? 'text-slate-900 border-b-2 border-slate-900'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Members ({members.length})
        </button>

        {canManageMembers && (
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'invitations'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Invitations ({invitations.length})
          </button>
        )}
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="max-w-md">
            <Input
              placeholder="Search members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-full" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No members match search"
              description="Try adjusting your filter terms or invite a new collaborator."
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {filteredMembers.map((member) => {
                  const isCurrentUser = member.userId === user?.id;
                  const isOwner = member.role === 'OWNER';
                  const canModifyThisMember =
                    canManageMembers &&
                    !isCurrentUser &&
                    (currentRole === 'OWNER' || (currentRole === 'ADMIN' && member.role !== 'OWNER' && member.role !== 'ADMIN'));

                  return (
                    <div
                      key={member.id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* User Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 text-white font-semibold text-sm flex items-center justify-center shrink-0">
                          {member.user?.fullName
                            ? member.user.fullName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {member.user?.fullName || 'Collaborator'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {member.user?.email}
                          </div>
                        </div>
                      </div>

                      {/* Role & Actions */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-xs text-slate-400 tabular-nums hidden md:inline">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>

                        {canModifyThisMember ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.userId, e.target.value as WorkspaceRole)
                            }
                            className="text-xs font-semibold rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            {currentRole === 'OWNER' && <option value="OWNER">OWNER</option>}
                            <option value="ADMIN">ADMIN</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                              isOwner
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : member.role === 'ADMIN'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {member.role}
                          </span>
                        )}

                        {canModifyThisMember && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            aria-label="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING INVITATIONS */}
      {activeTab === 'invitations' && canManageMembers && (
        <div className="space-y-4">
          {invitations.length === 0 ? (
            <EmptyState
              icon={<Mail className="w-6 h-6" />}
              title="No pending invitations"
              description="Invite team members to collaborate on projects and issue triage."
              action={{
                label: 'Invite Member',
                onClick: () => {
                  setInviteResult(null);
                  setInviteEmail('');
                  setInviteRole('MEMBER');
                  setInviteModalOpen(true);
                },
              }}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {invitations.map((inv) => {
                  const clientUrl = window.location.origin;
                  const tokenSample = inv.id;
                  const isCopied = copiedToken === inv.id;

                  return (
                    <div
                      key={inv.id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {inv.invitedEmail}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>Role: <strong>{inv.role}</strong></span>
                            <span>·</span>
                            <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          onClick={() => {
                            // Since tokenHash is stored, copy invite route instruction
                            const fallbackUrl = `${clientUrl}/invite`;
                            handleCopyLink(fallbackUrl, inv.id);
                          }}
                        >
                          {isCopied ? 'Copied' : 'Invite Page'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          aria-label="Revoke invitation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INVITE MEMBER MODAL */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Invite to Workspace
                  </h2>
                  <p className="text-xs text-slate-500">
                    Send invitation to join {currentWorkspace.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
                  <div className="font-bold text-sm text-emerald-900 mb-1 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Invitation Ready
                  </div>
                  {inviteResult.emailSent ? (
                    <p>An invitation email was sent to {inviteEmail}.</p>
                  ) : (
                    <p>
                      Email provider is not configured in this environment. Share this secure invitation link directly with your teammate:
                    </p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono break-all text-slate-700">
                  {inviteResult.inviteUrl}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => handleCopyLink(inviteResult.inviteUrl, 'modal')}
                  >
                    {copiedToken === 'modal' ? 'Copied Link!' : 'Copy Link'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setInviteModalOpen(false);
                      setInviteResult(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <Input
                  label="Teammate's Email Address"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Workspace Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="MEMBER">MEMBER (Can view, file issues, collaborate)</option>
                    <option value="ADMIN">ADMIN (Can invite, manage settings & roles)</option>
                    <option value="VIEWER">VIEWER (Read-only access)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setInviteModalOpen(false)}
                    disabled={isInviting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isInviting}
                  >
                    Generate Invitation
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REMOVE MEMBER CONFIRMATION MODAL */}
      {memberToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Remove Member?
            </h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to remove <strong>{memberToRemove.user?.fullName}</strong> from {currentWorkspace.name}? They will lose access to all projects and issues in this workspace.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRemove}
                isLoading={isRemoving}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
