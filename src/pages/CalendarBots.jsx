import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Settings, RefreshCw, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

function ConnectDialog({ open, onOpenChange }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/calendarbots`;
      const state = crypto.randomUUID();
      sessionStorage.setItem('google_calendar_oauth_state', state);
      const res = await appClient.functions.invoke('recallCalendarOAuth', {
        action: 'get_auth_url', redirect_uri: returnUrl, state,
      });
      if (res.error) throw res.error;
      if (!res.data?.auth_url) throw new Error(res.data?.error || 'Google OAuth URL was not returned.');
      window.location.href = res.data.auth_url;
    } catch (error) {
      sessionStorage.removeItem('google_calendar_oauth_state');
      toast.error(error.message || 'Could not start Google Calendar connection.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Connect Google Calendar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-slate-600">
            Connect your Google Calendar so a Recall AI bot automatically joins your meetings.
            You'll need to authorize access to your calendar events.
          </p>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
            <p className="font-medium text-slate-700">What this does:</p>
            <p>• Reads your calendar events to find meeting links</p>
            <p>• Automatically sends a bot to upcoming meetings</p>
            <p>• Bot records and transcribes the call</p>
          </div>
          <p className="text-xs text-slate-500">
            During Google OAuth testing, the Google account you choose must be listed under Google Auth Platform → Audience → Test users.
          </p>
          <p className="text-xs text-slate-500 break-all">
            Google OAuth redirect URI for this site: {`${window.location.origin}/calendarbots`}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Connect with Google
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ calendar, open, onOpenChange, onSaved }) {
  const [botName, setBotName] = useState(calendar?.bot_name || 'Notetaker');
  const [autoRecord, setAutoRecord] = useState(calendar?.auto_record ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBotName(calendar?.bot_name || 'Notetaker');
    setAutoRecord(calendar?.auto_record ?? true);
  }, [calendar]);

  const handleSave = async () => {
    setSaving(true);
    const result = await appClient.functions.invoke('recallCalendarOAuth', {
      action: 'update_settings',
      calendar_entity_id: calendar.id,
      bot_name: botName,
      auto_record: autoRecord,
    });
    setSaving(false);
    if (result.error || result.data?.error) {
      toast.error(result.error?.message || result.data?.error || 'Could not save calendar settings.');
      return;
    }
    toast.success('Settings saved');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bot Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Bot Display Name</Label>
            <Input value={botName} onChange={e => setBotName(e.target.value)} placeholder="Notetaker" />
            <p className="text-xs text-slate-400 mt-1">This name appears in the meeting for participants</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-record all meetings</p>
              <p className="text-xs text-slate-400">Send bot to every meeting with a video link</p>
            </div>
            <Switch checked={autoRecord} onCheckedChange={setAutoRecord} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarBots() {
  const [showConnect, setShowConnect] = useState(false);
  const [settingsCal, setSettingsCal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const handleSyncCalls = async () => {
    setSyncing(true);
    try {
      const res = await appClient.functions.invoke('syncRecallCalls', {});
      if (res.error) throw res.error;
      if (res.data?.ok) {
        const { scheduled, updated, connecting } = res.data;
        const parts = [];
        if (scheduled) parts.push(`${scheduled} bot${scheduled !== 1 ? 's' : ''} scheduled`);
        if (updated) parts.push(`${updated} transcript${updated !== 1 ? 's' : ''} backfilled`);
        toast.success(parts.length ? `Synced ${parts.join(', ')}`
          : connecting ? 'Calendar authorization is still syncing. Try again shortly.' : 'No new calls to sync');
        queryClient.invalidateQueries({ queryKey: ['recall-calendar-events'] });
        queryClient.invalidateQueries({ queryKey: ['recall-calendars'] });
      } else throw new Error(res.data?.error || res.data?.failures?.join('; ') || 'Sync failed');
    } catch (error) {
      toast.error(error.message || 'Recall sync failed. Check the Supabase function configuration.');
    } finally {
      setSyncing(false);
    }
  };

  // Check if returned from OAuth with code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const returnUrl = `${window.location.origin}/calendarbots`;

    if (code) {
      const expectedState = sessionStorage.getItem('google_calendar_oauth_state');
      const returnedState = params.get('state');
      sessionStorage.removeItem('google_calendar_oauth_state');
      window.history.replaceState({}, '', window.location.pathname);
      if (!expectedState || returnedState !== expectedState) {
        toast.error('Google Calendar connection could not be verified. Please try again.');
        return;
      }
      appClient.functions.invoke('recallCalendarOAuth', {
        action: 'exchange_code',
        code,
        redirect_uri: returnUrl,
      }).then(res => {
        if (res.error) throw res.error;
        if (res.data?.success) {
          toast.success(res.data.status === 'connected' ? 'Google Calendar connected!' : 'Google Calendar authorized. Sync is starting.');
          queryClient.invalidateQueries({ queryKey: ['recall-calendars'] });
        } else {
          toast.error('Connection failed: ' + (res.data?.error || 'Unknown error'));
        }
      }).catch(error => toast.error('Connection failed: ' + (error.message || 'Supabase function is unavailable.')));
    }

    if (error) {
      const description = params.get('error_description') || error;
      toast.error('Google Calendar connection failed: ' + description);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: calendars = [], isLoading } = useQuery({
    queryKey: ['recall-calendars', currentUser?.id],
    queryFn: () => currentUser
      ? appClient.entities.RecallCalendar.filter({ tenant_id: currentUser.id }, '-created_date')
      : [],
    enabled: !!currentUser,
    refetchInterval: query => query.state.data?.some(calendar => calendar.status === 'connecting') ? 10000 : false,
  });

  const { data: botEvents = [] } = useQuery({
    queryKey: ['recall-calendar-events', currentUser?.id],
    queryFn: () => appClient.entities.RecallCalendarEvent.filter({ tenant_id: currentUser.id }, '-start_time', 10),
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
  });

  const handleDisconnect = async (cal) => {
    if (!confirm(`Disconnect ${cal.user_email}?`)) return;
    const result = await appClient.functions.invoke('recallCalendarOAuth', {
      action: 'disconnect',
      calendar_entity_id: cal.id,
      recall_calendar_id: cal.recall_calendar_id,
    });
    if (result.error || result.data?.error) {
      toast.error(result.error?.message || result.data?.error || 'Could not disconnect this calendar.');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['recall-calendars'] });
    toast.success('Calendar disconnected');
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            Calendar Bots
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Recall AI bots automatically join meetings from connected calendars
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncCalls} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Calls
          </Button>
          <Button onClick={() => setShowConnect(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Connect Calendar
          </Button>
        </div>
      </div>

      {/* Webhook info - dev only */}
      {window.location.hostname === 'localhost' && (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
        <p className="font-medium mb-1 flex items-center gap-2"><Settings className="w-4 h-4" />Local integration</p>
        <p className="text-xs text-indigo-700">Calendar sync needs the Supabase Recall webhook and scheduled reconciliation function. Subscribe to calendar.sync_events, calendar.update, bot.in_waiting_room, bot.done, bot.fatal, recording.done, recording.failed, transcript.done, and transcript.failed.</p>
      </div>
      )}

      {botEvents.some(event => event.bot_error || event.bot_status === 'in_waiting_room' || event.bot_status === 'fatal') && (
        <section className="space-y-2" aria-label="Meeting bot activity">
          <h2 className="text-sm font-semibold text-slate-800">Recent bot issues</h2>
          {botEvents.filter(event => event.bot_error || event.bot_status === 'in_waiting_room' || event.bot_status === 'fatal').slice(0, 5).map(event => (
            <div key={event.id} className={`rounded-lg border p-3 text-sm ${event.bot_error || event.bot_status === 'fatal' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="font-medium">{event.meeting_title || 'Calendar meeting'} · {event.bot_status?.replaceAll('_', ' ') || 'Scheduling issue'}</p>
              {event.bot_error && <p className="mt-1 text-xs">{event.bot_error}</p>}
              {event.bot_status === 'in_waiting_room' && <p className="mt-1 text-xs">The meeting host may need to admit the bot.</p>}
            </div>
          ))}
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : calendars.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-4">No calendars connected yet.</p>
          <Button variant="outline" onClick={() => setShowConnect(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Connect your first calendar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {calendars.map(cal => (
            <div key={cal.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{cal.user_email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {cal.status === 'connected' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-medium ${cal.status === 'connecting' ? 'text-amber-600' : 'text-rose-600'}`}>
                          <AlertCircle className="w-3.5 h-3.5" /> {cal.status}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">Google Calendar</span>
                    </div>
                    {cal.sync_error && <p role="alert" className="mt-2 text-xs text-rose-600">Last sync issue: {cal.sync_error}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        Bot: <strong>{cal.bot_name || 'Notetaker'}</strong>
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cal.auto_record ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {cal.auto_record ? 'Auto-record ON' : 'Auto-record OFF'}
                      </span>
                      {cal.last_synced && (
                        <span className="text-xs text-slate-400">
                          Last synced {format(new Date(cal.last_synced), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSettingsCal(cal)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDisconnect(cal)}
                    className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    title="Disconnect"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConnectDialog open={showConnect} onOpenChange={setShowConnect} />
      {settingsCal && (
        <SettingsDialog
          calendar={settingsCal}
          open={!!settingsCal}
          onOpenChange={open => !open && setSettingsCal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['recall-calendars'] })}
        />
      )}
    </div>
  );
}


