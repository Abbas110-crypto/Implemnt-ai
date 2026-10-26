import React from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import StatsGrid from '../components/dashboard/StatsGrid';
import ClientCard from '../components/dashboard/ClientCard';
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { tenant_id, isReady } = useTenant();

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => appClient.auth.me(),
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    enabled: !!currentUser && isReady,
    queryKey: ['clients', tenant_id],
    queryFn: () => appClient.entities.Client.filter({ tenant_id, project_owner: currentUser?.email }, '-created_date'),
  });

  const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => appClient.entities.Milestone.list(),
  });

  const isLoading = loadingClients || loadingMilestones;

  const activeClients = clients.filter(c => c.onboarding_stage !== 'completed');
  const recentClients = activeClients.slice(0, 8);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Your project pipeline at a glance</p>
        </div>
        <Link to="/clients">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Onboarding */}
      <OnboardingChecklist />

      {/* Stats */}
      <StatsGrid clients={clients} milestones={milestones} />

      {/* Active Clients */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Active Projects</h2>
          <Link to="/clients" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </Link>
        </div>
        {recentClients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500 text-sm">No active projects yet.</p>
            <Link to="/clients">
              <Button variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Add your first project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentClients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
