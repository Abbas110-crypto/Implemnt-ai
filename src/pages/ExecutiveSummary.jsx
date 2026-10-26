import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Loader2, Send, BarChart2, CheckCircle2, X, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DATA_POINTS = [
  { key: 'project_overview', label: 'Project Overview', desc: 'Total, active, completed counts by stage' },
  { key: 'milestone_progress', label: 'Milestone Progress', desc: 'Completed vs in-progress vs blocked' },
  { key: 'overdue_milestones', label: 'Overdue Milestones', desc: 'All past-due items with days late' },
  { key: 'risk_flags', label: 'Risk Flags', desc: 'Keywords flagged in recent calls' },
  { key: 'health_scores', label: 'Health Scores', desc: 'Average score and at-risk projects' },
  { key: 'recent_calls', label: 'Recent Calls', desc: 'Last 5 logged calls' },
  { key: 'budget_summary', label: 'Budget Summary', desc: 'Total budget under management' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const EMPTY = {
  name: '',
  recipients: [],
  frequency: 'weekly',
  day_of_week: 'monday',
  day_of_month: 1,
  data_points: ['project_overview', 'milestone_progress', 'overdue_milestones', 'health_scores'],
  enabled: true,
};

function ConfigEditor({ config, open, onOpenChange, onSaved, tenant_id }) {
  const [form, setForm] = useState(config || EMPTY);
  const [recipientInput, setRecipientInput] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(config || EMPTY);
    setRecipientInput('');
  }, [config, open]);

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if ((form.recipients || []).includes(email)) return;
    setForm(f => ({ ...f, recipients: [...(f.recipients || []), email] }));
    setRecipientInput('');
  };

  const removeRecipient = (email) => setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));

  const toggleDataPoint = (key) => {
    const current = form.data_points || [];
    setForm(f => ({
      ...f,
      data_points: current.includes(key) ? current.filter(k => k !== key) : [...current, key],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Report name is required');
    if (!form.recipients?.length) return toast.error('Add at least one recipient');
    if (!form.data_points?.length) return toast.error('Select at least one data section');
    setSaving(true);
    if (config?.id) {
      await appClient.entities.ExecutiveSummaryConfig.update(config.id, form);
    } else {
      await appClient.entities.ExecutiveSummaryConfig.create({ ...form, tenant_id });
    }
    setSaving(false);
    toast.success('Report configuration saved');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config?.id ? 'Edit Report' : 'New Executive Summary Report'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div>
            <Label>Report Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly Leadership Report" />
          </div>

          {/* Recipients */}
          <div>
            <Label className="mb-2 block">Recipients *</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(form.recipients || []).map(r => (
                <span key={r} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-1 rounded-full">
                  <Mail className="w-3 h-3" />{r}
                  <button onClick={() => removeRecipient(r)} className="ml-1 hover:text-rose-500"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={recipientInput}
                onChange={e => setRecipientInput(e.target.value)}
                placeholder="Add email address…"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
              />
              <Button type="button" variant="outline" onClick={addRecipient}>Add</Button>
            </div>
          </div>

          {/* Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.frequency === 'weekly' && (
              <div>
                <Label>Day of Week</Label>
                <Select value={form.day_of_week || 'monday'} onValueChange={v => setForm({ ...form, day_of_week: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.frequency === 'monthly' && (
              <div>
                <Label>Day of Month</Label>
                <Input type="number" min="1" max="28" value={form.day_of_month || 1} onChange={e => setForm({ ...form, day_of_month: Number(e.target.value) })} />
              </div>
            )}
          </div>

          {/* Data Sections */}
          <div>
            <Label className="mb-2 block">Data Sections to Include</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DATA_POINTS.map(dp => {
                const selected = (form.data_points || []).includes(dp.key);
                return (
                  <button
                    key={dp.key}
                    type="button"
                    onClick={() => toggleDataPoint(dp.key)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${selected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      <span className={`text-sm font-medium ${selected ? 'text-indigo-800' : 'text-slate-700'}`}>{dp.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-0">{dp.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExecutiveSummary() {
  const { tenant_id, isReady } = useTenant();
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState({});
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['exec-summary-configs', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.ExecutiveSummaryConfig.filter({ tenant_id }, '-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.ExecutiveSummaryConfig.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['exec-summary-configs'] }); toast.success('Report deleted'); },
  });

  const toggleEnabled = async (config) => {
    await appClient.entities.ExecutiveSummaryConfig.update(config.id, { enabled: !config.enabled });
    queryClient.invalidateQueries({ queryKey: ['exec-summary-configs'] });
  };

  const sendNow = async (config) => {
    toast.info(`Email delivery is not connected yet. Add an email provider before sending to ${config.recipients.length} recipient(s).`);
  };

  const freqLabel = (c) => {
    if (c.frequency === 'daily') return 'Every day';
    if (c.frequency === 'weekly') return `Every ${c.day_of_week || 'Monday'}`;
    if (c.frequency === 'monthly') return `Monthly on the ${ordinal(c.day_of_month || 1)}`;
    return c.frequency;
  };

  if (isLoading) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600" />
            Executive Summaries
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure automated reports delivered to management or any team member</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Report
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 flex items-start gap-3">
        <BarChart2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-0.5">Automated executive reporting</p>
          <p className="text-xs text-indigo-700">Configure report contents and schedule here. Email delivery needs an email provider connection before reports can be sent.</p>
        </div>
      </div>

      {configs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-4">No reports configured yet.</p>
          <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Create your first report
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(config => (
            <div key={config.id} className={`bg-white rounded-xl border-2 transition-all ${config.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{config.name}</h3>
                      <Switch checked={config.enabled} onCheckedChange={() => toggleEnabled(config)} />
                      <span className="text-xs text-slate-400">{config.enabled ? 'Active' : 'Paused'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />{freqLabel(config)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />{config.recipients?.length || 0} recipient(s)
                      </span>
                      {config.last_sent && (
                        <span className="text-slate-400">Last sent {format(new Date(config.last_sent), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(config.data_points || []).map(dp => {
                        const info = DATA_POINTS.find(d => d.key === dp);
                        return (
                          <span key={dp} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                            {info?.label || dp}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendNow(config)}
                      disabled={sending[config.id]}
                      className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      {sending[config.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Email setup
                    </Button>
                    <button onClick={() => { setEditing(config); setDialogOpen(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(config.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Recipients preview */}
                {config.recipients?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {config.recipients.map(r => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfigEditor
        config={editing}
        tenant_id={tenant_id}
      />
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
