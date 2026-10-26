import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appClient } from '@/api/appClient';
import MondayCRMPicker from '../clients/MondayCRMPicker';
import { toast } from 'sonner';

export default function EditClientDialog({ client, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) setForm({ ...client });
  }, [client]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await appClient.entities.Client.update(client.id, {
      company_name: form.company_name,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      arr: form.arr ? Number(form.arr) : undefined,
      target_go_live: form.target_go_live,
      project_owner: form.project_owner,
      team_members: form.team_members,
      onboarding_stage: form.onboarding_stage,
      health_score: form.health_score ? Number(form.health_score) : undefined,
      notes: form.notes,
      monday_contact_id: form.monday_contact_id || undefined,
      monday_contact_name: form.monday_contact_name || undefined,
      monday_contact_email: form.monday_contact_email || undefined,
      monday_account_name: form.monday_account_name || undefined,
    });
    setSaving(false);
    toast.success('Client updated');
    onSaved?.();
    onOpenChange(false);
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} required />
            </div>
            <div>
              <Label>Contact Name *</Label>
              <Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} required />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input type="email" value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <Label>Budget ($)</Label>
              <Input type="number" value={form.arr || ''} onChange={e => setForm({ ...form, arr: e.target.value })} />
            </div>
            <div>
              <Label>Target Go-Live</Label>
              <Input type="date" value={form.target_go_live || ''} onChange={e => setForm({ ...form, target_go_live: e.target.value })} />
            </div>
            <div>
              <Label>Project Owner (email)</Label>
              <Input value={form.project_owner || form.csm_owner || ''} onChange={e => setForm({ ...form, project_owner: e.target.value })} placeholder="owner@company.com" />
            </div>
            <div className="col-span-2">
              <Label>Team Members (comma-separated emails)</Label>
              <Input
                value={Array.isArray(form.team_members) ? form.team_members.join(', ') : (form.team_members || '')}
                onChange={e => setForm({ ...form, team_members: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="alice@co.com, bob@co.com"
              />
            </div>
            <div>
              <Label>Health Score (0–100)</Label>
              <Input type="number" min="0" max="100" value={form.health_score || ''} onChange={e => setForm({ ...form, health_score: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Onboarding Stage</Label>
              <Select value={form.onboarding_stage || 'kickoff'} onValueChange={v => setForm({ ...form, onboarding_stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['kickoff','configuration','integration','training','go_live','completed'].map(s => (
                    <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>
                  ))}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
