import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Building,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { workspaceService } from '../../services/workspace.service';
import { Invitation } from '../../types/workspace';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';

export const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchInvitation = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await workspaceService.getInvitationByToken(token);
      setInvitation(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invitation not found or invalid token.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvitation();
  }, [fetchInvitation]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      const res = await workspaceService.acceptInvitation(token);
      addToast('Invitation accepted! Welcome to the team.', 'success');
      await refreshWorkspaces();
      switchWorkspace(res.workspaceId);
      navigate('/dashboard');
    } catch (err: any) {
      addToast(err.message || 'Failed to accept invitation', 'error');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setIsDeclining(true);
    try {
      await workspaceService.declineInvitation(token);
      addToast('Invitation declined', 'info');
      navigate('/dashboard');
    } catch (err: any) {
      addToast(err.message || 'Failed to decline invitation', 'error');
    } finally {
      setIsDeclining(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate(`/login?redirect=/invite/${token}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200">
          <LoadingSkeleton className="h-8 w-48 mb-4" />
          <LoadingSkeleton className="h-4 w-full mb-2" />
          <LoadingSkeleton className="h-4 w-3/4 mb-6" />
          <LoadingSkeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (errorMessage || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">
            Invalid Invitation
          </h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {errorMessage || 'This invitation link is invalid or no longer exists.'}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isExpired = invitation.status === 'EXPIRED';
  const isRevoked = invitation.status === 'REVOKED';
  const isAccepted = invitation.status === 'ACCEPTED';
  const emailMatches =
    isAuthenticated &&
    user?.email.toLowerCase() === invitation.invitedEmail.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-xs">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            T
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Workspace Invitation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            You&apos;ve been invited to join <strong>{invitation.workspace?.name}</strong>
          </p>
        </div>

        {/* Details Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6 space-y-2.5 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Invited By:</span>
            <span className="font-semibold text-slate-800">
              {invitation.inviter?.fullName || 'Workspace Administrator'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Assigned Role:</span>
            <span className="font-semibold text-blue-600">{invitation.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Invited Email:</span>
            <span className="font-mono text-slate-700">{invitation.invitedEmail}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status:</span>
            <span className="font-semibold uppercase tracking-wider">{invitation.status}</span>
          </div>
        </div>

        {/* Status Handlers */}
        {isAccepted && (
          <div className="text-center space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>This invitation has already been accepted.</span>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        )}

        {isExpired && (
          <div className="text-center space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>This invitation expired. Please request a new invite.</span>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Return to Dashboard
            </Button>
          </div>
        )}

        {isRevoked && (
          <div className="text-center space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>This invitation was revoked by the workspace administrator.</span>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Return to Dashboard
            </Button>
          </div>
        )}

        {invitation.status === 'PENDING' && (
          <>
            {!isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 text-center mb-4">
                  Please sign in or create an account with <strong>{invitation.invitedEmail}</strong> to accept this invitation.
                </p>
                <Link
                  to={`/login?email=${encodeURIComponent(invitation.invitedEmail)}`}
                  className="block w-full"
                >
                  <Button variant="primary" size="md" className="w-full">
                    Sign in to Accept
                  </Button>
                </Link>
                <Link
                  to={`/register?email=${encodeURIComponent(invitation.invitedEmail)}`}
                  className="block w-full"
                >
                  <Button variant="secondary" size="md" className="w-full">
                    Create New Account
                  </Button>
                </Link>
              </div>
            ) : emailMatches ? (
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleAccept}
                  isLoading={isAccepting}
                >
                  Accept Invitation
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={handleDecline}
                  isLoading={isDeclining}
                >
                  Decline
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs leading-relaxed">
                  <p className="font-semibold mb-1">Signed in as {user?.email}</p>
                  <p>
                    This invitation was addressed to <strong>{invitation.invitedEmail}</strong>. You must be signed in with that email address to join.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  leftIcon={<LogOut className="w-4 h-4" />}
                  onClick={handleSwitchAccount}
                >
                  Switch Account
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
