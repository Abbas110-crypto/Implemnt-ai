import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp, RefreshCw, Minus, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SendToMondayDialog from '@/components/call-insights/SendToMondayDialog';

const SENTIMENT_CONFIG = {
  positive:  { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: TrendingUp, label: 'Positive' },
  neutral:   { color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200',     icon: Minus,      label: 'Neutral' },
  concerned: { color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     icon: AlertTriangle, label: 'Concerned' },
  negative:  { color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         icon: TrendingDown, label: 'Negative' },
};

const PRIORITY_COLORS = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function SentimentBar({ score }) {
  const pct = Math.round(((score + 1) / 2) * 100);
  const color = score >= 0.3 ? 'bg-emerald-400' : score >= -0.2 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{score > 0 ? '+' : ''}{score.toFixed(2)}</span>
    </div>
  );
}

function CallInsightCard({ call, clients, onAnalyze, analyzing, onSendToMonday }) {
  const [expanded, setExpanded] = useState(false);
  const client = clients.find(c => c.id === call.client_id);
  const hasSummary = !!call.summary;
  const sentCfg = SENTIMENT_CONFIG[call.sentiment] || SENTIMENT_CONFIG.neutral;
  const SentIcon = sentCfg.icon;

  return (
    <div className={`bg-white rounded-xl border p-5 ${hasSummary ? sentCfg.bg : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {call.sentiment && (
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${sentCfg.bg} ${sentCfg.color}`}>
                <SentIcon className="w-3 h-3" /> {sentCfg.label}
              </span>
            )}
            {client && <span className="text-xs text-slate-400">{client.company_name}</span>}
            {call.call_date && (
              <span className="text-xs text-slate-400">{format(new Date(call.call_date), 'MMM d, yyyy')}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{call.title}</h3>
          {call.summary && (
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{call.summary}</p>
          )}
          {!call.summary && (call.notes || call.transcript_url) && (
            <p className="text-xs text-slate-400 mt-1 italic">Transcript available — run analysis to extract insights</p>
          )}
          {!call.notes && !call.transcript_url && (
            <p className="text-xs text-slate-300 mt-1 italic">No transcript</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {(call.notes || call.transcript_url) && (
            <Button size="sm" variant={hasSummary ? 'outline' : 'default'} onClick={() => onAnalyze(call.id)}
              disabled={analyzing === call.id}
              className={`gap-1.5 text-xs h-7 ${!hasSummary ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}>
              {analyzing === call.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {hasSummary ? 'Re-analyze' : 'Analyze'}
            </Button>
          )}
          {(call.notes || call.transcript_url) && !call.monday_item_id && (
            <Button size="sm" variant="outline" onClick={() => onSendToMonday(call)}
              className="gap-1.5 text-xs h-7 text-red-600 border-red-200 hover:bg-red-50">
              <Send className="w-3 h-3" />
              → Monday
            </Button>
          )}
          {call.monday_item_id && call.monday_board_id && (
            <a
              href={`https://${call.monday_account_slug ? call.monday_account_slug + '.' : ''}monday.com/boards/${call.monday_board_id}/pulses/${call.monday_item_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
            >
              <CheckCircle2 className="w-3 h-3" /> View in Monday <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {hasSummary && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Less' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {expanded && call.risk_flags?.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Pain Points
            </p>
            <ul className="space-y-1">
              {call.risk_flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.severity === 'high' ? 'bg-red-400' : f.severity === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                  {f.context}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendSummary({ calls }) {
  const analyzed = calls.filter(c => c.summary);
  const bysentiment = { positive: 0, neutral: 0, concerned: 0, negative: 0 };
  analyzed.forEach(c => { if (c.sentiment) bysentiment[c.sentiment] = (bysentiment[c.sentiment] || 0) + 1; });
  const highRisk = calls.filter(c => c.risk_flags?.some(f => f.severity === 'high'));

  if (!analyzed.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-500" /> Sentiment Trends ({analyzed.length} analyzed calls)
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => {
          const SIcon = cfg.icon;
          return (
            <div key={key} className={`rounded-lg border p-3 text-center ${cfg.bg}`}>
              <SIcon className={`w-4 h-4 mx-auto mb-1 ${cfg.color}`} />
              <p className={`text-lg font-bold ${cfg.color}`}>{bysentiment[key] || 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </div>
          );
        })}
      </div>
      {highRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {highRisk.length} call{highRisk.length !== 1 ? 's' : ''} with high-severity issues — prioritize follow-up
          </p>
          <ul className="space-y-0.5">
            {highRisk.map(c => (
              <li key={c.id} className="text-xs text-red-600">• {c.title} {c.call_date ? `(${format(new Date(c.call_date), 'MMM d')})` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CallInsights() {
  const { tenant_id, isReady } = useTenant();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(null);
  const [mondayCall, setMondayCall] = useState(null);
  const [filter, setFilter] = useState('all');

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['call-logs-insights'],
    queryFn: () => appClient.entities.CallLog.list('-call_date', 100),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-light', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.Client.filter({ tenant_id }, '-created_date', 100),
  });

  const handleAnalyze = async (id) => {
    setAnalyzing(id);
    const res = await appClient.functions.invoke('analyzeCallTranscript', { call_log_id: id });
    if (res.data?.ok) {
      toast.success('Analysis complete');
      queryClient.invalidateQueries({ queryKey: ['call-logs-insights'] });
    } else {
      toast.error(res.data?.error || 'Analysis failed');
    }
    setAnalyzing(null);
  };

  const handleSendToMonday = (call) => setMondayCall(call);

  const filteredCalls = calls.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'unanalyzed') return !c.summary && c.notes;
    if (filter === 'high_risk') return c.risk_flags?.some(f => f.severity === 'high');
    return c.sentiment === filter;
  });

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unanalyzed', label: 'Unanalyzed' },
    { key: 'negative', label: 'Negative' },
    { key: 'concerned', label: 'Concerned' },
    { key: 'positive', label: 'Positive' },
    { key: 'high_risk', label: 'High Risk' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Call Insights
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Rule-based sentiment and risk keyword checks across call transcripts.</p>
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['call-logs-insights'] })}
          className="text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <TrendSummary calls={calls} />

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : filteredCalls.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Brain className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No calls match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''}</p>
          {filteredCalls.map(call => (
            <CallInsightCard
              key={call.id}
              call={call}
              clients={clients}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              onSendToMonday={handleSendToMonday}
            />
          ))}
        </div>
      )}
      <SendToMondayDialog
        open={!!mondayCall}
        onOpenChange={(o) => !o && setMondayCall(null)}
        call={mondayCall}
        onSent={() => queryClient.invalidateQueries({ queryKey: ['call-logs-insights'] })}
      />
    </div>
  );
}

