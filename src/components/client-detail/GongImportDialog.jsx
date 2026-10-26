import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appClient } from '@/api/appClient';
import { Loader2, FileText } from 'lucide-react';
import { analyzeTranscript } from '@/lib/callAnalysis';
import { toast } from 'sonner';

export default function GongImportDialog({ open, onOpenChange, clientId, client, milestones, onImported }) {
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [participants, setParticipants] = useState('');
  const [duration, setDuration] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);

    const result = analyzeTranscript(transcript, { milestones });

    const callDate = new Date().toISOString();
    await appClient.entities.GongCall.create({
      gong_call_id: `manual-${Date.now()}`,
      client_id: clientId,
      title: title || `Call with ${client?.company_name || 'Client'}`,
      call_date: callDate,
      duration_minutes: duration ? Number(duration) : null,
      transcript,
      participants,
      summary: result.summary,
      extracted_milestones: result.extracted_milestones || [],
      crm_updates: result.crm_updates || [],
      structured_notes: result.structured_notes,
      status: 'pending_review',
    });

    setAnalyzing(false);
    toast.success('Call imported and analyzed — ready for review');
    setTitle(''); setTranscript(''); setParticipants(''); setDuration('');
    onOpenChange(false);
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Import Gong Call Transcript
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Call Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={`Onboarding call with ${client?.company_name || 'client'}`} />
            </div>
            <div>
              <Label>Participants</Label>
              <Input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="John, Sarah, Alex…" />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" />
            </div>
          </div>
          <div>
            <Label>Paste Transcript *</Label>
            <Textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste the full Gong transcript here…"
              className="h-52 font-mono text-xs"
            />
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-700">
            Deterministic keyword rules will identify mentioned milestones and follow-up items. Review the imported transcript before applying any updates.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleAnalyze}
              disabled={!transcript.trim() || analyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Analyze & Import</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

