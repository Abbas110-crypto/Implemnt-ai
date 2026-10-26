import React, { useState } from 'react';
import { RefreshCw, Settings, Loader2, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';

const levelConfig = {
  low: { label: 'Low', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function ChurnRiskRow({ client, onSync, onEditHubspot }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await onSync();
    setSyncing(false);
  };

  const level = client.churn_risk_level || 'low';
  const config = levelConfig[level] || levelConfig.low;
  const score = client.churn_risk_score ?? '—';
  const hubspotLinked = !!(client.hubspot_contact_id || client.hubspot_deal_id || client.salesforce_contact_id || client.churnzero_account_id);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {client.company_name?.charAt(0)?.toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{client.company_name}</p>
        <p className="text-xs text-slate-400 truncate">{client.contact_name}</p>
      </div>

      {/* Score bar */}
      <div className="hidden sm:flex flex-col items-end gap-1 w-28">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              level === 'critical' ? 'bg-rose-500' :
              level === 'high' ? 'bg-orange-500' :
              level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{score !== '—' ? `${score}/100` : '—'}</span>
      </div>

      {/* Risk badge */}
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${config.cls}`}>
        {config.label}
      </span>

      {/* HubSpot linked indicator */}
      <span className={`hidden sm:flex items-center gap-1 text-xs ${hubspotLinked ? 'text-emerald-600' : 'text-slate-300'}`}>
        <LinkIcon className="w-3 h-3" />
        {hubspotLinked ? 'CRM linked' : 'No CRM'}
      </span>

      {/* Last sync */}
      {client.last_hubspot_sync && (
        <span className="hidden lg:block text-xs text-slate-400 shrink-0">
          {format(new Date(client.last_hubspot_sync), 'MMM d, h:mm a')}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEditHubspot}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          title="Configure HubSpot IDs"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
          title="Sync to HubSpot"
        >
          {syncing
            ? <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          }
        </button>
      </div>
    </div>
  );
}