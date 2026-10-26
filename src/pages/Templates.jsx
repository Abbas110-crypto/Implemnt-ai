import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Loader2, LayoutTemplate, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const EMPTY_FORM = { name: '', description: '', stage_order: [], default_milestones: [] };

function TemplateEditor({ template, open, onOpenChange, onSaved, tenant_id }) {
  const [form, setForm] = useState(template || EMPTY_FORM);
  const [newStage, setNewStage] = useState('');
  const [newMilestone, setNewMilestone] = useState({ title: '', stage: '' });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(template || EMPTY_FORM);
  }, [template]);

  const addStage = () => {
    const key = newStage.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || form.stage_order.includes(key)) return;
    setForm(f => ({ ...f, stage_order: [...f.stage_order, key] }));
    setNewStage('');
  };

  const removeStage = (key) => {
    setForm(f => ({
      ...f,
      stage_order: f.stage_order.filter(s => s !== key),
      default_milestones: f.default_milestones.filter(m => m.stage !== key),
    }));
  };

  const addMilestone = () => {
    if (!newMilestone.title.trim() || !newMilestone.stage) return;
    const ms = form.default_milestones.filter(m => m.stage === newMilestone.stage);
    setForm(f => ({
      ...f,
      default_milestones: [...f.default_milestones, { ...newMilestone, sort_order: ms.length + 1 }],
    }));
    setNewMilestone({ title: '', stage: newMilestone.stage });
  };

  const removeMilestone = (idx) => {
    setForm(f => ({ ...f, default_milestones: f.default_milestones.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Template name required');
    if (form.stage_order.length === 0) return toast.error('Add at least one stage');
    setSaving(true);
    if (template?.id) {
      await appClient.entities.ProjectTemplate.update(template.id, form);
    } else {
      await appClient.entities.ProjectTemplate.create({ ...form, tenant_id });
    }
    setSaving(false);
    toast.success('Template saved');
    onSaved();
    onOpenChange(false);
  };

  const stageLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template?.id ? 'Edit Template' : 'New Project Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Template Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Software Implementation, Marketing Campaign" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this project type" />
            </div>
          </div>

          {/* Stages */}
          <div>
            <Label className="mb-2 block">Phases / Stages</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.stage_order.map(s => (
                <div key={s} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-1 rounded-full font-medium">
                  {stageLabel(s)}
                  <button onClick={() => removeStage(s)} className="ml-1 hover:text-rose-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newStage} onChange={e => setNewStage(e.target.value)} placeholder="Add stage, e.g. Discovery" className="flex-1"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStage())} />
              <Button type="button" variant="outline" onClick={addStage}>Add</Button>
            </div>
          </div>

          {/* Milestones */}
          {form.stage_order.length > 0 && (
            <div>
              <Label className="mb-2 block">Default Milestones</Label>
              {form.stage_order.map(stage => {
                const items = form.default_milestones.filter(m => m.stage === stage);
                return (
                  <div key={stage} className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{stageLabel(stage)}</p>
                    <div className="space-y-1 mb-2">
                      {items.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 rounded px-3 py-1.5 text-sm">
                          <GripVertical className="w-3 h-3 text-slate-300" />
                          <span className="flex-1 text-slate-700">{m.title}</span>
                          <button onClick={() => removeMilestone(form.default_milestones.indexOf(m))} className="text-slate-300 hover:text-rose-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newMilestone.stage === stage ? newMilestone.title : ''}
                        onChange={e => setNewMilestone({ title: e.target.value, stage })}
                        placeholder={`Add milestone to ${stageLabel(stage)}…`}
                        className="flex-1 h-7 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); if (newMilestone.stage === stage) addMilestone(); }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => { if (newMilestone.stage === stage) addMilestone(); else setNewMilestone({ title: '', stage }); }}>
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const { tenant_id, isReady } = useTenant();
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.ProjectTemplate.filter({ tenant_id }, '-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.ProjectTemplate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted'); },
  });

  const stageLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (isLoading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Define reusable stage & milestone sets for different project types</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <LayoutTemplate className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-4">No templates yet. Create one to speed up project setup.</p>
          <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(t); setDialogOpen(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(t.stage_order || []).map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                    {stageLabel(s)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{(t.default_milestones || []).length} default milestones</p>
            </div>
          ))}
        </div>
      )}

      <TemplateEditor
        template={editing}
        tenant_id={tenant_id}
      />
    </div>
  );
}
