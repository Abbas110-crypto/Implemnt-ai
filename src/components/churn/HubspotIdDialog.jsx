import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const CRM_SECTIONS = [
  {
    label: 'HubSpot',
    color: 'text-orange-600',
    fields: [
      { key: 'hubspot_contact_id', label: 'Contact ID', placeholder: 'e.g. 12345678' },
      { key: 'hubspot_deal_id', label: 'Deal ID', placeholder: 'e.g. 98765432' },
    ],
  },
  {
    label: 'Salesforce',
    color: 'text-blue-600',
    fields: [
      { key: 'salesforce_contact_id', label: 'Contact / Account ID', placeholder: 'e.g. 003Dn000002XXXXX' },
    ],
  },
  {
    label: 'ChurnZero',
    color: 'text-violet-600',
    fields: [
      { key: 'churnzero_account_id', label: 'Account External ID', placeholder: 'e.g. acme-corp' },
    ],
  },
];

const ALL_KEYS = CRM_SECTIONS.flatMap(s => s.fields.map(f => f.key));

export default function HubspotIdDialog({ client, open, onOpenChange, onSaved }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      const init = {};
      ALL_KEYS.forEach(k => { init[k] = client[k] || ''; });
      setValues(init);
    }
  }, [client]);

  const handleSave = async () => {
    setSaving(true);
    const update = {};
    ALL_KEYS.forEach(k => { update[k] = values[k]?.trim() || null; });
    await appClient.entities.Client.update(client.id, update);
    toast.success('CRM IDs saved');
    onSaved();
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>CRM IDs — {client?.company_name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500">
          Configure IDs for each CRM you want to sync churn risk scores to.
        </p>
        <div className="space-y-5 mt-2">
          {CRM_SECTIONS.map(section => (
            <div key={section.label}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${section.color}`}>{section.label}</p>
              <div className="space-y-2">
                {section.fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
