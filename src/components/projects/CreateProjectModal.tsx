import React, { useState, useEffect } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { projectService } from '../../services/project.service';
import { workspaceService } from '../../services/workspace.service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { Project, ProjectVisibility } from '../../types/project';
import { WorkspaceMember } from '../../types/workspace';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

const COLOR_OPTIONS = [
  { name: 'Blue', value: 'blue', bg: 'bg-blue-600' },
  { name: 'Emerald', value: 'emerald', bg: 'bg-emerald-600' },
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-600' },
  { name: 'Violet', value: 'violet', bg: 'bg-violet-600' },
  { name: 'Amber', value: 'amber', bg: 'bg-amber-600' },
  { name: 'Rose', value: 'rose', bg: 'bg-rose-600' },
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onProjectCreated }) => {
  const { currentWorkspace } = useWorkspace();
  const { addToast } = useToast();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('WORKSPACE');
  const [leadId, setLeadId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('blue');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      workspaceService.listMembers(currentWorkspace.id)
        .then((list) => setMembers(list))
        .catch(() => setMembers([]));
    }
  }, [isOpen, currentWorkspace?.id]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    const generatedKey = val
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 5);
    setKey(generatedKey);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!key.trim()) {
      setError('Project key is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const newProj = await projectService.createProject({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
        workspaceId: currentWorkspace.id,
        leadId: leadId || undefined,
        visibility,
        startDate: startDate || null,
        targetDate: targetDate || null,
        color,
      });

      addToast(`Project ${newProj.key} created successfully`, 'success');
      onProjectCreated(newProj);
      onClose();
      setName('');
      setKey('');
      setDescription('');
      setVisibility('WORKSPACE');
      setLeadId('');
      setStartDate('');
      setTargetDate('');
      setColor('blue');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      addToast(err.message || 'Failed to create project', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Create New Project</h2>
              <p className="text-xs text-slate-500">Organize work streams, issues, and team members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input
                label="Project Name"
                placeholder="e.g. Mobile App Redesign"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>
            <div>
              <Input
                label="Project Key"
                placeholder="MAR"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                required
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all resize-none"
              placeholder="Briefly describe the goal or scope of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Project Lead
              </label>
              <select
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">Select Lead...</option>
                {members.map((m: WorkspaceMember) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.fullName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Visibility
              </label>
              <select
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}
              >
                <option value="WORKSPACE">Workspace (All Members)</option>
                <option value="PRIVATE">Private (Members Only)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Target Date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Project Color Accent
            </label>
            <div className="flex items-center gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center transition-transform ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105 opacity-80'
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
