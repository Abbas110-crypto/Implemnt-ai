import React, { useState } from 'react';
import { useTenant } from '@/lib/useTenant';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Send, Loader2, AlertTriangle, Bot, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SEVERITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS = {
  pending_review: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
  sent_to_monday: 'bg-emerald-100 text-emerald-700',
};

function ActionItemCard({ item, clients, onApprove, onReject, onSendToMonday, loading }) {
  const [expanded, setExpanded] = useState(false);
  const client = clients.find(c => c.id === item.client_id);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.medium}`}>
              {item.severity?.toUpperCase() || 'MEDIUM'}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] || STATUS_COLORS.pending_review}`}>
              {item.status?.replace(/_/g, ' ').toUpperCase()}
            </span>
            {client && <span className="text-xs text-slate-400">{client.company_name}</span>}
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
          {item.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
          )}
          {item.triggered_by_keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.triggered_by_keywords.map(kw => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{kw}</span>
              ))}
            </div>
          )}
          {item.context_snippet && (
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-2">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Transcript excerpt
            </button>
          )}
          {expanded && item.context_snippet && (
            <blockquote className="mt-2 pl-3 border-l-2 border-slate-200 text-xs text-slate-500 italic">
              {item.context_snippet}
            </blockquote>
          )}
          <p className="text-[10px] text-slate-300 mt-2">{format(new Date(item.created_date), 'MMM d, yyyy h:mm a')}</p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {item.status === 'pending_review' && (
            <>
              <Button size="sm" onClick={() => onApprove(item.id)} disabled={loading === item.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-7">
                {loading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(item.id)} disabled={loading === item.id}
                className="gap-1.5 text-xs h-7 text-rose-600 border-rose-200 hover:bg-rose-50">
                <XCircle className="w-3 h-3" /> Reject
              </Button>
            </>
          )}
          {item.status === 'approved' && (
            <Button size="sm" onClick={() => onSendToMonday(item.id)} disabled={loading === item.id}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-7">
              {loading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send to Monday
            </Button>
          )}
          {item.status === 'sent_to_monday' && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sent
              </span>
              {item.monday_item_id && item.monday_board_id && (
                <a
                  href={`https://monday.com/boards/${item.monday_board_id}/pulses/${item.monday_item_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  View in Monday <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActionItems() {
  const { tenant_id, isReady } = useTenant();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);
  const [filter, setFilter] = useState('pending_review');
  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState('');
  const [agentRunning, setAgentRunning] = useState(false);
  const [testingMonday, setTestingMonday] = useState(false);
  const [mondayTestResult, setMondayTestResult] = useState(null); // null | {ok, message}

  const { data: actionItems = [], isLoading } = useQuery({
    queryKey: ['action-items', filter],
    queryFn: () => filter === 'all'
      ? appClient.entities.ActionItem.list('-created_date', 100)
      : appClient.entities.ActionItem.filter({ status: filter }, '-created_date', 100),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-light', tenant_id],
    enabled: isReady,
    queryFn: () => appClient.entities.Client.filter({ tenant_id }, '-created_date', 100),
  });

  const { data: callLogs = [], isLoading: callLogsLoading } = useQuery({
    queryKey: ['call-logs-light'],
    queryFn: () => appClient.entities.CallLog.list('-call_date', 100),
  });

  const callOptions = callLogs.map(c => ({ id: c.id, label: c.title + (c.call_date ? ' · ' + format(new Date(c.call_date), 'MMM d, yyyy') : '') }));

  const handleApprove = async (id) => {
    setLoading(id);
    await appClient.entities.ActionItem.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['action-items'] });
    toast.success('Action item approved');
    setLoading(null);
  };

  const handleReject = async (id) => {
    setLoading(id);
    await appClient.entities.ActionItem.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['action-items'] });
    toast.success('Action item rejected');
    setLoading(null);
  };

  const handleSendToMonday = async (id) => {
    setLoading(id);
    const res = await appClient.functions.invoke('sendToMonday', { action_item_id: id });
    if (res.data?.success) {
      if (res.data.status_warning) toast.warning(res.data.status_warning);
      else toast.success(res.data.status_updated ? 'Sent to Monday.com and updated its status.' : 'Sent to Monday.com.');
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    } else {
      toast.error(res.data?.error || 'Failed to send to Monday');
    }
    setLoading(null);
  };

  const handleTestMonday = async () => {
    setTestingMonday(true);
    setMondayTestResult(null);
    const res = await appClient.functions.invoke('testIntegration', { platform: 'monday' });
    if (res.data?.success) {
      const parts = [];
      if (res.data.user_name) parts.push(`Connected as ${res.data.user_name}`);
      if (res.data.account_name) parts.push(res.data.account_name);
      const prefix = parts.length ? parts.join(' · ') + '. ' : 'Monday.com connected. ';
      setMondayTestResult({ ok: true, message: `${prefix}Found ${res.data.board_count ?? '?'} board(s).` });
    } else {
      setMondayTestResult({ ok: false, message: res.data?.error || 'Connection failed' });
    }
    setTestingMonday(false);
  };

  const handleRunAgent = async () => {
    if (!selectedCallId) { toast.error('Please select a call'); return; }
    setAgentRunning(true);
    try {
      const result = await appClient.functions.invoke('analyzeCallTranscript', { call_log_id: selectedCallId });
      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error);
      toast.success(`Local rules found ${result.data?.analysis?.risk_flags?.length || 0} risk matches.`);
      setAgentOpen(false);
      setSelectedCallId('');
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    } catch (e) {
      toast.error('Call analysis failed: ' + e.message);
    }
    setAgentRunning(false);
  };

  const counts = {
    pending_review: actionItems.filter ? undefined : 0,
  };

  const FILTERS = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'sent_to_monday', label: 'Sent to Monday' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Action Items
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Rule-detected follow-up and risk items from call transcripts, reviewed before sending to Monday.com.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestMonday} disabled={testingMonday} className="gap-2 text-xs h-9">
            {testingMonday ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Test Monday
          </Button>
          <Button onClick={() => setAgentOpen(!agentOpen)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Bot className="w-4 h-4" /> Analyze Call
          </Button>
        </div>
      </div>

      {mondayTestResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${mondayTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mondayTestResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{mondayTestResult.message}</span>
          <button onClick={() => setMondayTestResult(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {agentOpen && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-indigo-800 flex items-center gap-2"><Bot className="w-4 h-4" /> Scan a Call with Local Rules</p>
          <div className="flex gap-3">
            <select value={selectedCallId} onChange={e => setSelectedCallId(e.target.value)}
              className="flex-1 h-9 text-sm border border-input rounded-md px-2 bg-white" disabled={callLogsLoading}>
              <option value="">{callLogsLoading ? 'Loading calls...' : callOptions.length === 0 ? 'No calls found' : 'Select a call...'}</option>
              {callOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <Button onClick={handleRunAgent} disabled={agentRunning || !selectedCallId} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {agentRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Run
            </Button>
          </div>
          <p className="text-xs text-indigo-600">The agent will compare the transcript to your active risk keywords and create action items for review.</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : actionItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No action items found.</p>
          <p className="text-xs text-slate-400 mt-1">Run the agent on a call to detect risks and generate action items.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{actionItems.length} item{actionItems.length !== 1 ? 's' : ''}</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['action-items'] })}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {actionItems.map(item => (
            <ActionItemCard
              key={item.id}
              item={item}
              clients={clients}
              onApprove={handleApprove}
              onReject={handleReject}
              onSendToMonday={handleSendToMonday}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
