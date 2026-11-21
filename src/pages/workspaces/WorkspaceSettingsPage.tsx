import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  AlertTriangle,
  Layers,
  Save,
  Check,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/feedback/EmptyState';

export const WorkspaceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, currentRole, updateWorkspace, deleteWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const isOwner = currentRole === 'OWNER';
  const canEditSettings = currentRole === 'OWNER' || currentRole === 'ADMIN';

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description || '');
    }
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={<Settings className="w-6 h-6" />}
        title="No active workspace"
        description="Select or create a workspace to view and manage settings."
      />
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim(),
      });
      addToast('Workspace settings updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update workspace', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirmName !== currentWorkspace.name) {
      addToast('Please type the exact workspace name to confirm deletion', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkspace(currentWorkspace.id);
      addToast('Workspace has been permanently deleted', 'info');
      setDeleteModalOpen(false);
      navigate('/dashboard');
    } catch (err: any) {
      addToast(err.message || 'Failed to delete workspace', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          <span>Settings</span>
          <span aria-hidden="true">·</span>
          <span>{currentWorkspace.name}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Workspace Settings
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure general workspace parameters, identifiers, and administration policies.
        </p>
      </div>

      {/* General Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-none">
              General Information
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Public workspace display details
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEditSettings}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Workspace Slug (URL Key)
            </label>
            <input
              type="text"
              value={currentWorkspace.slug}
              readOnly
              className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Unique URL identifier for this workspace
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEditSettings}
              placeholder="What does this workspace work on?"
            />
          </div>

          {canEditSettings && (
            <div className="flex justify-end pt-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                leftIcon={<Save className="w-4 h-4" />}
                isLoading={isSaving}
              >
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-3 mb-4 text-rose-600">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 leading-none">
              Danger Zone
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Deleting this workspace will immediately and permanently revoke access for all {currentWorkspace.memberCount} member(s). This action cannot be reversed.
          </p>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => {
              setConfirmName('');
              setDeleteModalOpen(true);
            }}
          >
            Delete Workspace
          </Button>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">
                Confirm Workspace Deletion
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              This action <strong>cannot</strong> be undone. Please type the workspace name <strong>{currentWorkspace.name}</strong> to confirm.
            </p>

            <Input
              label="Type workspace name to confirm"
              placeholder={currentWorkspace.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mb-6"
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={confirmName !== currentWorkspace.name}
                isLoading={isDeleting}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
