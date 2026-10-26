import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { analyzeTranscript } from '@/lib/callAnalysis';
import { toast } from 'sonner';

export default function LogCallDialog({ open, onOpenChange, clientId, client, milestones, onCallLogged }) {
  const [form, setForm] = useState({
    title: '',
    call_date: new Date().toISOString().slice(0, 16),
    duration_minutes: '',
    attendees: '',
    notes: '',
  });
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    const riskKeywords = await appClient.entities.RiskKeyword.filter({ active: true });
    const analysis = analyzeTranscript(form.notes, { riskKeywords, milestones });

    // Create the call log
    const milestoneUpdates = (analysis.milestone_updates || []).map(u => {
      const ms = milestones.find(m => m.id === u.milestone_id);
      return {
        milestone_id: u.milestone_id,
        old_status: ms?.status || 'not_started',
        new_status: u.new_status,
        reason: u.reason,
      };
    });

    const callLog = await appClient.entities.CallLog.create({
      client_id: clientId,
      title: form.title,
      call_date: form.call_date,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      attendees: form.attendees,
      notes: form.notes,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      action_items: analysis.action_items,
      milestone_updates: milestoneUpdates,
      risk_flags: analysis.risk_flags,
    });

    // Apply milestone updates
    for (const update of analysis.milestone_updates || []) {
      if (update.milestone_id) {
        await appClient.entities.Milestone.update(update.milestone_id, {
          status: update.new_status,
          auto_updated: true,
          update_source_call_id: callLog.id,
          completed_date: update.new_status === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
        });
      }
    }

    const riskCount = analysis.risk_flags.length;
    if (riskCount > 0) {
      toast.warning(`Call logged with ${milestoneUpdates.length} timeline updates and ${riskCount} risk flag(s) for management`);
    } else {
      toast.success(`Call logged with ${milestoneUpdates.length} timeline updates`);
    }
    setProcessing(false);
    setForm({ title: '', call_date: new Date().toISOString().slice(0, 16), duration_minutes: '', attendees: '', notes: '' });
    onOpenChange(false);
    onCallLogged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" />
            Log Call & Review Suggested Updates
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Call Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Weekly Sync, Integration Check-in"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.call_date}
                onChange={(e) => setForm({ ...form, call_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>
          <div>
            <Label>Attendees</Label>
            <Input
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              placeholder="Jane Doe, John Smith"
            />
          </div>
          <div>
            <Label>Call Notes / Transcript *</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Paste the call notes or transcript. Keyword rules will identify configured risks and clear milestone status phrases..."
              className="h-36"
              required
            />
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
            <div className="flex items-center gap-2 text-sm text-indigo-700">
              <Zap className="w-4 h-4" />
              <span className="font-medium">Rule-based analysis will:</span>
            </div>
            <ul className="text-xs text-indigo-600 mt-1.5 space-y-0.5 ml-6 list-disc">
              <li>Create a short extractive summary</li>
              <li>Flag follow-up phrases as action items</li>
              <li>Suggest milestone status changes when status wording is explicit</li>
              <li>Flag risk keywords for management alerts</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
              Cancel
            </Button>
            <Button type="submit" disabled={processing} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Log & Process Call
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
