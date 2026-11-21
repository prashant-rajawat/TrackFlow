import React, { useState } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isCustomSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustomSlug(true);
    setSlug(slugify(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    if (name.trim().length < 2) {
      setError('Workspace name must be at least 2 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await createWorkspace({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
      });

      addToast('Workspace created successfully!', 'success');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-none">
                Create Workspace
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Collaborative home for your team and issues
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="e.g. Acme Engineering"
            value={name}
            onChange={handleNameChange}
            required
            autoFocus
          />

          <div>
            <Input
              label="Workspace URL Slug"
              placeholder="acme-engineering"
              value={slug}
              onChange={handleSlugChange}
              helperText={`trackflow.app/${slug || 'your-slug'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-slate-800 focus:ring-slate-900/10 min-h-[72px]"
              placeholder="Brief summary of this team or organization..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
