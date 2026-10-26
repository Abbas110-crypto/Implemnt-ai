import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ClientCard from '../components/dashboard/ClientCard';
import NewClientDialog from '../components/clients/NewClientDialog';
import { Plus, Search, Loader2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Clients() {
  const { tenant_id, isReady } = useTenant();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.Client.filter({ tenant_id }, '-created_date'),
  });

  const createClientMutation = useMutation({
    mutationFn: async ({ clientData, milestones }) => {
      const created = await appClient.entities.Client.create({ ...clientData, tenant_id });
      if (milestones?.length) {
        const milestonesWithClient = milestones.map(m => ({
          ...m,
          client_id: created.id,
          status: 'not_started',
        }));
        await appClient.entities.Milestone.bulkCreate(milestonesWithClient);
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      setShowNew(false);
    },
  });

  const handleSave = async (clientData, milestones) => {
    await createClientMutation.mutateAsync({ clientData, milestones });
  };

  const filtered = clients.filter(c => {
    const matchSearch = c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || c.onboarding_stage === stageFilter;
    return matchSearch && matchStage;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} total projects</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="pl-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="kickoff">Kickoff</SelectItem>
            <SelectItem value="configuration">Configuration</SelectItem>
            <SelectItem value="integration">Integration</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="go_live">Go Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">
            {search || stageFilter !== 'all' ? 'No projects match your filters.' : 'No projects yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      <NewClientDialog open={showNew} onOpenChange={setShowNew} onSave={handleSave} />
    </div>
  );
}
