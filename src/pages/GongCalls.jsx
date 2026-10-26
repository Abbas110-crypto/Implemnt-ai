import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import GongCallReviewDialog from '../components/gong/GongCallReviewDialog';
import { toast } from 'sonner';

const statusConfig = {
  pending_review: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: XCircle },
};

export default function GongCalls() {
  const [selectedCall, setSelectedCall] = useState(null);
  const queryClient = useQueryClient();

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['gong-calls'],
    queryFn: () => appClient.entities.GongCall.list('-call_date'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => appClient.entities.Client.list(),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ callId, updates }) => {
      const user = await appClient.auth.me();
      await appClient.entities.GongCall.update(callId, {
        status: 'approved',
        approved_by: user.email,
        approved_date: new Date().toISOString(),
      });
      
      // Apply milestone updates
      if (updates.milestones) {
        for (const m of updates.milestones) {
          await appClient.entities.Milestone.update(m.milestone_id, { status: m.suggested_status });
        }
      }
      
      // Apply client updates
      if (updates.client) {
        await appClient.entities.Client.update(updates.client.client_id, updates.client.updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gong-calls'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      toast.success('Call approved and synced');
      setSelectedCall(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (callId) => appClient.entities.GongCall.update(callId, { status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gong-calls'] });
      toast.success('Call rejected');
      setSelectedCall(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const pendingCalls = calls.filter(c => c.status === 'pending_review');

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Call Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Review imported calls and approve record updates</p>
        </div>
        {pendingCalls.length > 0 && (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-sm px-3 py-1">
            {pendingCalls.length} pending review
          </Badge>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Phone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-2">No Gong calls yet</p>
          <p className="text-xs text-slate-400">Calls will appear here when synced from Gong</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const config = statusConfig[call.status] || statusConfig.pending_review;
            const Icon = config.icon;
            const client = clients.find(c => c.id === call.client_id);

            return (
              <div
                key={call.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
                      <h3 className="font-semibold text-slate-900 truncate">{call.title}</h3>
                      <Badge className={`${config.color} shrink-0`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      {client && <span className="font-medium text-slate-700">{client.company_name}</span>}
                      <span>{format(new Date(call.call_date), 'MMM d, yyyy h:mm a')}</span>
                      {call.duration_minutes && <span>{call.duration_minutes} min</span>}
                      {call.participants && <span>{call.participants}</span>}
                    </div>

                    {call.summary && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{call.summary}</p>
                    )}

                    {call.status === 'pending_review' && (
                      <div className="flex items-center gap-2 text-xs">
                        {call.extracted_milestones?.length > 0 && (
                          <span className="px-2 py-1 rounded bg-violet-50 text-violet-700 border border-violet-200">
                            {call.extracted_milestones.length} milestone updates
                          </span>
                        )}
                        {call.crm_updates?.length > 0 && (
                          <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {call.crm_updates.length} record updates
                          </span>
                        )}
                      </div>
                    )}

                    {call.approved_by && (
                      <p className="text-xs text-slate-400 mt-2">
                        Approved by {call.approved_by} on {format(new Date(call.approved_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {call.status === 'pending_review' && (
                      <Button
                        onClick={() => setSelectedCall(call)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Review & Approve
                      </Button>
                    )}
                    {call.status !== 'pending_review' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCall && (
        <GongCallReviewDialog
          call={selectedCall}
          client={clients.find(c => c.id === selectedCall.client_id)}
          open={!!selectedCall}
          onOpenChange={(open) => !open && setSelectedCall(null)}
          onApprove={(updates) => approveMutation.mutate({ callId: selectedCall.id, updates })}
          onReject={() => rejectMutation.mutate(selectedCall.id)}
          isLoading={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </div>
  );
}

