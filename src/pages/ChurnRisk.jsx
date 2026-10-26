import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Settings, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ChurnRiskRow from '../components/churn/ChurnRiskRow';

const levelColors = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function ChurnRisk() {
  const { tenant_id, isReady } = useTenant();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-churn', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.Client.filter({ tenant_id }, '-churn_risk_score'),
  });

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await appClient.functions.invoke('calculateChurnRisk', {});
    setSyncResult(res.data?.success ? res.data : { error: res.data?.error || res.error?.message || 'Risk calculation failed' });
    queryClient.invalidateQueries({ queryKey: ['clients-churn'] });
    setSyncing(false);
  };

  const counts = {
    critical: clients.filter(c => c.churn_risk_level === 'critical').length,
    high: clients.filter(c => c.churn_risk_level === 'high').length,
    medium: clients.filter(c => c.churn_risk_level === 'medium').length,
    low: clients.filter(c => c.churn_risk_level === 'low' || !c.churn_risk_level).length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            Risk Monitor
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Keyword-based risk scores from project call notes and transcripts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/riskkeywords">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Keywords
            </Button>
          </Link>
          <Button
            onClick={handleSyncAll}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate Risk
          </Button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult?.success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-emerald-700">
          <Check className="w-4 h-4 shrink-0" />
          Recalculated risk for {syncResult.results?.length} projects.
        </div>
      )}
      {syncResult?.error && <p role="alert" className="text-sm text-rose-700">{syncResult.error}</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Critical', key: 'critical', color: 'rose' },
          { label: 'High', key: 'high', color: 'orange' },
          { label: 'Medium', key: 'medium', color: 'amber' },
          { label: 'Low', key: 'low', color: 'emerald' },
        ].map(({ label, key, color }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold text-${color}-600`}>{counts[key]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label} Risk</p>
          </div>
        ))}
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {clients.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">No clients found.</p>
          ) : (
            clients.map(client => (
              <ChurnRiskRow
                key={client.id}
                client={client}
              />
            ))
          )}
        </div>
      )}

    </div>
  );
}
