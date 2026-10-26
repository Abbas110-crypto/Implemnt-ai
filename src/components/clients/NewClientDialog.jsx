import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import MondayCRMPicker from './MondayCRMPicker';

const defaultMilestones = [
  { title: 'Kickoff Call', stage: 'kickoff', sort_order: 1 },
  { title: 'Define Success Criteria', stage: 'kickoff', sort_order: 2 },
  { title: 'Account Configuration', stage: 'configuration', sort_order: 3 },
  { title: 'User Roles & Permissions', stage: 'configuration', sort_order: 4 },
  { title: 'API Integration Setup', stage: 'integration', sort_order: 5 },
  { title: 'Data Migration', stage: 'integration', sort_order: 6 },
  { title: 'Integration Testing', stage: 'integration', sort_order: 7 },
  { title: 'Admin Training', stage: 'training', sort_order: 8 },
  { title: 'End User Training', stage: 'training', sort_order: 9 },
  { title: 'Go-Live Checklist', stage: 'go_live', sort_order: 10 },
  { title: 'Go-Live Support', stage: 'go_live', sort_order: 11 },
];

export default function NewClientDialog({ open, onOpenChange, onSave }) {
  const { tenant_id } = useTenant();
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', tenant_id],
    enabled: !!tenant_id,
    queryFn: () => appClient.entities.ProjectTemplate.filter({ tenant_id }),
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    onboarding_stage: 'kickoff',
    health_score: 80,
    start_date: new Date().toISOString().split('T')[0],
    target_go_live: '',
    arr: '',
    monday_contact_id: '',
    monday_contact_name: '',
    monday_contact_email: '',
    monday_account_name: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const template = templates.find(t => t.id === selectedTemplate);
    const milestones = template?.default_milestones?.length
      ? template.default_milestones
      : defaultMilestones;
    await onSave(
      { ...form, arr: form.arr ? Number(form.arr) : undefined, template_id: selectedTemplate || undefined,
        monday_contact_id: form.monday_contact_id || undefined,
        monday_contact_name: form.monday_contact_name || undefined,
        monday_contact_email: form.monday_contact_email || undefined,
        monday_account_name: form.monday_account_name || undefined,
      },
      milestones
    );
    setSaving(false);
    setForm({
      company_name: '', contact_name: '', contact_email: '',
      onboarding_stage: 'kickoff', health_score: 80,
      start_date: new Date().toISOString().split('T')[0], target_go_live: '', arr: '',
      monday_contact_id: '', monday_contact_name: '', monday_contact_email: '', monday_account_name: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {templates.length > 0 && (
          <div>
            <Label>Project Template (optional)</Label>
            <Select value={selectedTemplate || 'none'} onValueChange={v => setSelectedTemplate(v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template — custom setup</SelectItem>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
              <p className="text-xs text-indigo-600 mt-1">
                Will create {templates.find(t => t.id === selectedTemplate)?.default_milestones?.length || 0} milestones automatically
              </p>
            )}
          </div>
        )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Project / Company Name *</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp / Project Atlas"
                required
              />
            </div>
            <div>
              <Label>Project Lead *</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="jane@acme.com"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Target Go-Live</Label>
              <Input
                type="date"
                value={form.target_go_live}
                onChange={(e) => setForm({ ...form, target_go_live: e.target.value })}
              />
            </div>
            <div>
              <Label>Budget ($)</Label>
              <Input
                type="number"
                value={form.arr}
                onChange={(e) => setForm({ ...form, arr: e.target.value })}
                placeholder="50000"
              />
            </div>
            <div>
              <Label>Starting Stage</Label>
              <Select value={form.onboarding_stage} onValueChange={(v) => setForm({ ...form, onboarding_stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
          <div className="col-span-2">
              <MondayCRMPicker
                value={form}
                onChange={crm => setForm(f => ({ ...f, ...crm }))}
              />
            </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
