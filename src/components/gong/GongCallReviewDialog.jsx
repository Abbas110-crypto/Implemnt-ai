import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, FileText, Zap, Database, AlertCircle } from 'lucide-react';

export default function GongCallReviewDialog({ call, client, open, onOpenChange, onApprove, onReject, isLoading }) {
  const [selectedMilestones, setSelectedMilestones] = useState(
    call.extracted_milestones?.map(m => m.milestone_id) || []
  );
  const [selectedCrmUpdates, setSelectedCrmUpdates] = useState(
    call.crm_updates?.map((_, i) => i) || []
  );

  const handleApprove = () => {
    const updates = {
      milestones: call.extracted_milestones?.filter(m => selectedMilestones.includes(m.milestone_id)),
      client: selectedCrmUpdates.length > 0 ? {
        client_id: call.client_id,
        updates: call.crm_updates
          .filter((_, i) => selectedCrmUpdates.includes(i))
          .reduce((acc, update) => {
            const num = Number(update.suggested_value);
            acc[update.field] = !isNaN(num) && update.suggested_value !== '' ? num : update.suggested_value;
            return acc;
          }, {})
      } : null
    };
    onApprove(updates);
  };

  const toggleMilestone = (id) => {
    setSelectedMilestones(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleCrmUpdate = (index) => {
    setSelectedCrmUpdates(prev =>
      prev.includes(index) ? prev.filter(x => x !== index) : [...prev, index]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Review Gong Call Analysis
          </DialogTitle>
          {client && (
            <p className="text-sm text-slate-500">
              {client.company_name} • {format(new Date(call.call_date), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </DialogHeader>

        <Tabs defaultValue="summary" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="milestones">
              Milestones
              {call.extracted_milestones?.length > 0 && (
                <Badge className="ml-2 bg-violet-100 text-violet-700">{call.extracted_milestones.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="crm">
              CRM Updates
              {call.crm_updates?.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-700">{call.crm_updates.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[50vh] mt-4">
            <TabsContent value="summary" className="space-y-4 p-1">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Call Summary
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">{call.summary}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Call Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Duration:</span>
                    <span className="ml-2 text-slate-900 font-medium">{call.duration_minutes} minutes</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Participants:</span>
                    <span className="ml-2 text-slate-900 font-medium">{call.participants}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="milestones" className="space-y-3 p-1">
              {!call.extracted_milestones || call.extracted_milestones.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No milestone updates detected</p>
              ) : (
                call.extracted_milestones.map((milestone) => (
                  <div
                    key={milestone.milestone_id}
                    className={`border rounded-lg p-4 transition-all ${
                      selectedMilestones.includes(milestone.milestone_id)
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedMilestones.includes(milestone.milestone_id)}
                        onCheckedChange={() => toggleMilestone(milestone.milestone_id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 text-sm">Milestone #{milestone.milestone_id}</span>
                          <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                            {milestone.suggested_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">{milestone.reason}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="crm" className="space-y-3 p-1">
              {!call.crm_updates || call.crm_updates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No CRM updates suggested</p>
              ) : (
                call.crm_updates.map((update, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-4 transition-all ${
                      selectedCrmUpdates.includes(i)
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedCrmUpdates.includes(i)}
                        onCheckedChange={() => toggleCrmUpdate(i)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-medium text-slate-900 text-sm capitalize">
                            {update.field.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                          <div>
                            <span className="text-slate-400">Current:</span>
                            <span className="ml-2 text-slate-600">{update.current_value || 'None'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Suggested:</span>
                            <span className="ml-2 text-slate-900 font-medium">{update.suggested_value}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600">{update.reason}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="notes" className="p-1">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {call.structured_notes || 'No structured notes available'}
                </pre>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {call.status === 'pending_review' && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertCircle className="w-4 h-4" />
              <span>Review and select updates to apply</span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onReject}
                disabled={isLoading}
                className="gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                {isLoading ? (
                  <>Loading...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
