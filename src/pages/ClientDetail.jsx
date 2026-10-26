import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Calendar, DollarSign, Mail, User, Pencil, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import TimelineView from '../components/client-detail/TimelineView';
import CallLogCard from '../components/client-detail/CallLogCard';

import EditClientDialog from '../components/client-detail/EditClientDialog';
import HealthBadge from '../components/shared/HealthBadge';
import StageBadge from '../components/shared/StageBadge';

export default function ClientDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => appClient.entities.Client.filter({ id: clientId }).then(r => r[0]),
    enabled: !!clientId,
  });

  const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
    queryKey: ['milestones', clientId],
    queryFn: () => appClient.entities.Milestone.filter({ client_id: clientId }, 'sort_order'),
    enabled: !!clientId,
  });

  const { data: calls = [], isLoading: loadingCalls } = useQuery({
    queryKey: ['calls', clientId],
    queryFn: () => appClient.entities.CallLog.filter({ client_id: clientId }, '-call_date'),
    enabled: !!clientId,
  });



  const handleUpdateMilestoneStatus = async (milestoneId, newStatus) => {
    await appClient.entities.Milestone.update(milestoneId, {
      status: newStatus,
      auto_updated: false,
      completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['milestones', clientId] });
  };



  const isLoading = loadingClient || loadingMilestones || loadingCalls;

  const allCalls = [...calls].sort((a, b) => new Date(b.call_date) - new Date(a.call_date));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Client not found.</p>
        <Link to="/clients" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">← Back to clients</Link>
      </div>
    );
  }

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const totalMilestones = milestones.length;
  const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
  const portalUrl = `${window.location.origin}/clientportal?token=${encodeURIComponent(client.portal_access_token)}`;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to clients
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {client.company_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{client.company_name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <StageBadge stage={client.onboarding_stage} />
                <HealthBadge score={client.health_score} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">

            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(portalUrl, '_blank', 'noopener,noreferrer')} className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Client Portal
            </Button>

          </div>
        </div>

        {/* Quick info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Contact</p>
              <p className="text-sm font-medium text-slate-700">{client.contact_name}</p>
            </div>
          </div>
          {client.contact_email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium text-slate-700 truncate">{client.contact_email}</p>
              </div>
            </div>
          )}
          {client.target_go_live && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Go-Live</p>
                <p className="text-sm font-medium text-slate-700">{format(new Date(client.target_go_live), 'MMM d, yyyy')}</p>
              </div>
            </div>
          )}
          {client.arr && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">ARR</p>
                <p className="text-sm font-medium text-slate-700">${client.arr.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Onboarding Progress</span>
            <span className="text-xs font-semibold text-slate-700">{completedMilestones}/{totalMilestones} milestones</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="calls">
            Calls {allCalls.length > 0 && <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{allCalls.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          {milestones.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500 text-sm">No milestones defined for this client.</p>
            </div>
          ) : (
            <TimelineView
            milestones={milestones}
            onUpdateStatus={handleUpdateMilestoneStatus}
            onMilestoneSaved={() => queryClient.invalidateQueries({ queryKey: ['milestones', clientId] })}
          />
          )}
        </TabsContent>

        <TabsContent value="calls" className="mt-4 space-y-3">
          {allCalls.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500 text-sm">No calls logged yet.</p>

            </div>
          ) : (
            allCalls.map(call => <CallLogCard key={call.id} call={call} />)
          )}
        </TabsContent>
      </Tabs>

      <EditClientDialog
        client={client}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['client', clientId] })}
      />


    </div>
  );
}
