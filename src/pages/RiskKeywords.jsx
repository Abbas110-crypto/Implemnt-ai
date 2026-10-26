import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Flag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const severityColors = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function RiskKeywords() {
  const { tenant_id, isReady } = useTenant();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ keyword: '', category: 'other', severity: 'medium', description: '', monday_status_value: '' });
  const queryClient = useQueryClient();

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['risk-keywords', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.RiskKeyword.filter({ tenant_id }, '-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => appClient.entities.RiskKeyword.create({ ...data, tenant_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-keywords'] });
      setShowNew(false);
      setForm({ keyword: '', category: 'other', severity: 'medium', description: '', monday_status_value: '' });
      toast.success('Keyword added');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.RiskKeyword.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-keywords'] });
      toast.success('Keyword updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.RiskKeyword.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-keywords'] });
      toast.success('Keyword deleted');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Risk Keywords</h1>
          <p className="text-sm text-slate-500 mt-1">Manage keywords to flag in call transcripts for project risk alerts</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Add Keyword
        </Button>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Flag className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-900">How it works</p>
            <p className="text-xs text-indigo-700 mt-1">
              When you log a call, local keyword rules scan the notes for these phrases. Matches create risk alerts with context and the configured severity.
            </p>
          </div>
        </div>
      </div>

      {keywords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Flag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-4">No risk keywords configured yet.</p>
          <Button variant="outline" onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add your first keyword
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900">"{keyword.keyword}"</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColors[keyword.severity]}`}>
                    {keyword.severity}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                    {keyword.category}
                  </span>
                </div>
                {keyword.description && (
                  <p className="text-sm text-slate-500">{keyword.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={keyword.active}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: keyword.id, data: { active: checked } })}
                  />
                  <span className="text-xs text-slate-500">{keyword.active ? 'Active' : 'Inactive'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(keyword.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Risk Keyword</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4 mt-2"
          >
            <div>
              <Label>Keyword or Phrase *</Label>
              <Input
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="e.g. delay, budget concern, frustrated"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="budget">Budget</SelectItem>
                    <SelectItem value="satisfaction">Satisfaction</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this keyword indicate?"
              />
            </div>
            {form.category === 'status' && (
              <div>
                <Label>Monday.com Status Value</Label>
                <Input
                  value={form.monday_status_value}
                  onChange={(e) => setForm({ ...form, monday_status_value: e.target.value })}
                  placeholder="e.g. At Risk, On Hold, Done"
                />
                <p className="text-xs text-slate-400 mt-1">When this keyword is detected in a call, the Monday.com project status will be set to this value.</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Add Keyword
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
