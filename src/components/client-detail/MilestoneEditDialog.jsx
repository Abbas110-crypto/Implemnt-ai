import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MilestoneEditDialog({ milestone, open, onOpenChange, onSaved, allMilestones = [] }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (milestone) {
      setForm({
        title: milestone.title || '',
        description: milestone.description || '',
        status: milestone.status || 'not_started',
        due_date: milestone.due_date || '',
        owner: milestone.owner || '',
        sort_order: milestone.sort_order ?? '',
        stage: milestone.stage || 'kickoff',
        depends_on: milestone.depends_on || [],
      });
    }
  }, [milestone]);

  const handleSave = async () => {
    setSaving(true);
    await appClient.entities.Milestone.update(milestone.id, {
      ...form,
      depends_on: form.depends_on,
      sort_order: form.sort_order !== '' ? Number(form.sort_order) : undefined,
      completed_date: form.status === 'completed' && !milestone.completed_date
        ? new Date().toISOString().split('T')[0]
        : milestone.completed_date,
    });
    setSaving(false);
    toast.success('Milestone updated');
    onSaved();
    onOpenChange(false);
  };

  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <Label>Description / Notes</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Add notes or context..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kickoff">Kickoff</SelectItem>
                  <SelectItem value="configuration">Configuration</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="go_live">Go Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: e.target.value })}
                placeholder="e.g. 5"
              />
            </div>
          </div>

          <div>
            <Label>Owner / Assignee</Label>
            <Input
              value={form.owner}
              onChange={e => setForm({ ...form, owner: e.target.value })}
              placeholder="e.g. john@company.com or John Smith"
            />
          </div>

          {allMilestones.filter(m => m.id !== milestone?.id).length > 0 && (
            <div>
              <Label>Depends On (blocks this until complete)</Label>
              <div className="mt-1 space-y-1 max-h-36 overflow-y-auto border border-input rounded-md p-2">
                {allMilestones.filter(m => m.id !== milestone?.id).map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={(form.depends_on || []).includes(m.id)}
                      onChange={e => {
                        const current = form.depends_on || [];
                        setForm({ ...form, depends_on: e.target.checked ? [...current, m.id] : current.filter(id => id !== m.id) });
                      }}
                    />
                    <span className="text-xs text-slate-700">{m.title}</span>
                    <span className="text-[10px] text-slate-400 ml-auto">{m.stage}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
