import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { CheckCircle2, Loader2, Link2, Unlink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';





function MondayConnectCard() {
  const redirectUri = `${window.location.origin}/integrations`;
  const [status, setStatus] = useState(null); // null=loading, {connected, account_name, user_name}
  const [working, setWorking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await appClient.functions.invoke('mondayOAuth', { action: 'get_status' });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      setStatus(res.data);
    } catch (error) {
      setStatus({ connected: false, error: error.message || 'Could not contact the Monday integration service.' });
      throw error;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error');
    if (oauthError && sessionStorage.getItem('monday_oauth_state')) {
      sessionStorage.removeItem('monday_oauth_state');
      sessionStorage.removeItem('monday_oauth_verifier');
      window.history.replaceState({}, '', window.location.pathname);
      toast.error(`Monday sign-in failed: ${oauthError}`);
      fetchStatus().catch(() => {});
      return;
    }
    if (code && sessionStorage.getItem('monday_oauth_state')) {
      const returnedState = params.get('state');
      const expectedState = sessionStorage.getItem('monday_oauth_state');
      const codeVerifier = sessionStorage.getItem('monday_oauth_verifier');
      sessionStorage.removeItem('monday_oauth_state');
      sessionStorage.removeItem('monday_oauth_verifier');
      window.history.replaceState({}, '', window.location.pathname);
      setWorking(true);
      if (!returnedState || returnedState !== expectedState || !codeVerifier) {
        toast.error('Monday sign-in could not be verified. Please connect again.');
        setWorking(false);
        return;
      }
      appClient.functions.invoke('mondayOAuth', {
        action: 'exchange_code', code, code_verifier: codeVerifier, redirect_uri: redirectUri,
      }).then(async result => {
        if (result.error) throw result.error;
        if (result.data?.success) toast.success('Monday.com connected!');
        else toast.error('Connection failed: ' + (result.data?.error || 'Unknown'));
      }).catch(error => toast.error('Connection failed: ' + (error.message || 'Unknown')))
        .finally(() => { setWorking(false); fetchStatus().catch(() => setStatus({ connected: false })); });
    } else {
      fetchStatus().catch(() => {});
    }
  }, []);

  const handleConnect = async () => {
    setWorking(true);
    try {
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const codeVerifier = btoa(String.fromCharCode(...randomBytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const result = await appClient.functions.invoke('mondayOAuth', {
        action: 'get_auth_url', redirect_uri: redirectUri, code_verifier: codeVerifier,
      });
      if (result.error || !result.data?.auth_url) throw new Error(result.error?.message || result.data?.error || 'Could not start Monday sign-in');
      sessionStorage.setItem('monday_oauth_state', result.data.state);
      sessionStorage.setItem('monday_oauth_verifier', codeVerifier);
      window.location.assign(result.data.auth_url);
    } catch (error) {
      toast.error(error.message || 'Could not start Monday sign-in');
      setWorking(false);
    }
  };

  const handleDisconnect = async () => {
    setWorking(true);
    const result = await appClient.functions.invoke('mondayOAuth', { action: 'disconnect' });
    if (result.error || result.data?.error) {
      toast.error(result.error?.message || result.data?.error || 'Could not disconnect Monday.com');
      setWorking(false);
      return;
    }
    toast.success('Monday.com disconnected');
    setStatus({ connected: false });
    setWorking(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMessage('');
    try {
      const result = await appClient.functions.invoke('testIntegration', { platform: 'monday' });
      if (result.error || !result.data?.success) throw new Error(result.data?.error || result.error?.message || 'Connection test failed');
      setTestMessage(`Connection works. ${result.data.board_count} board(s) available.`);
    } catch (error) {
      setTestMessage(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
        <span className="text-red-600 font-bold text-xs">MON</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">Monday.com</p>
        {status === null ? (
          <p className="text-xs text-slate-400">Checking connection...</p>
        ) : status.connected ? (
          <div>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</p>
            {status.account_name && <p className="text-xs text-slate-400">{status.user_name} · {status.account_name}</p>}
            {status.needs_reconnect && <p className="text-xs text-amber-700 mt-1">New permissions are needed. Reconnect Monday.com.</p>}
            {testMessage && <p role="status" className="text-xs text-slate-600 mt-1">{testMessage}</p>}
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400">Not connected</p>
            {status.error && <p role="alert" className="text-xs text-rose-600 mt-1">{status.error}</p>}
            <p className="text-[10px] text-slate-300 mt-0.5 break-all">Redirect URI: {redirectUri}</p>
          </div>
        )}
      </div>
      {status !== null && (
        status.connected ? (
          <div className="flex gap-2">
            {status.needs_reconnect && <Button variant="outline" size="sm" onClick={handleConnect} disabled={working}>Reconnect</Button>}
            <Button variant="outline" size="sm" onClick={handleTest} disabled={working || testing}>
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={working} className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50">
              {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={working} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
            {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Connect
          </Button>
        )
      )}
    </div>
  );
}

function HubSpotConnectCard() {
  const redirectUri = `${window.location.origin}/integrations`;
  const [status, setStatus] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = async () => {
    const result = await appClient.functions.invoke('hubspotOAuth', { action: 'get_status' });
    if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message || 'HubSpot status unavailable');
    setStatus(result.data);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expectedState = sessionStorage.getItem('hubspot_oauth_state');
    if (params.get('error') && expectedState) {
      sessionStorage.removeItem('hubspot_oauth_state');
      window.history.replaceState({}, '', window.location.pathname);
      setMessage(`HubSpot sign-in failed: ${params.get('error')}`);
    } else if (params.get('code') && expectedState) {
      const code = params.get('code');
      const state = params.get('state');
      sessionStorage.removeItem('hubspot_oauth_state');
      window.history.replaceState({}, '', window.location.pathname);
      if (state !== expectedState) setMessage('HubSpot sign-in could not be verified. Please connect again.');
      else {
        setWorking(true);
        appClient.functions.invoke('hubspotOAuth', {
          action: 'exchange_code', code, redirect_uri: redirectUri,
        }).then((result) => {
          if (result.error || !result.data?.success) throw new Error(result.data?.error || result.error?.message || 'Connection failed');
          setMessage(`Connected HubSpot account ${result.data.hub_id}.`);
        }).catch((error) => setMessage(error.message || 'Connection failed'))
          .finally(() => { setWorking(false); fetchStatus().catch((error) => setMessage(error.message)); });
      }
    }
    fetchStatus().catch((error) => { setStatus({ connected: false }); setMessage(error.message); });
  }, []);

  const handleConnect = async () => {
    setWorking(true);
    setMessage('');
    try {
      const state = crypto.randomUUID();
      const result = await appClient.functions.invoke('hubspotOAuth', {
        action: 'get_auth_url', state, redirect_uri: redirectUri,
      });
      if (result.error || !result.data?.auth_url) throw new Error(result.data?.error || result.error?.message || 'Could not start HubSpot sign-in');
      sessionStorage.setItem('hubspot_oauth_state', state);
      window.location.assign(result.data.auth_url);
    } catch (error) {
      setMessage(error.message || 'Could not start HubSpot sign-in');
      setWorking(false);
    }
  };

  const handleTest = async () => {
    setWorking(true);
    try {
      const result = await appClient.functions.invoke('hubspotOAuth', { action: 'test' });
      if (result.error || !result.data?.success) throw new Error(result.data?.error || result.error?.message || 'Test failed');
      setMessage('HubSpot connection works.');
    } catch (error) { setMessage(error.message || 'Test failed'); }
    finally { setWorking(false); }
  };

  const handleDisconnect = async () => {
    setWorking(true);
    try {
      const result = await appClient.functions.invoke('hubspotOAuth', { action: 'disconnect' });
      if (result.error || !result.data?.success) throw new Error(result.data?.error || result.error?.message || 'Disconnect failed');
      setStatus({ connected: false });
      setMessage('HubSpot disconnected.');
    } catch (error) { setMessage(error.message || 'Disconnect failed'); }
    finally { setWorking(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
        <span className="text-orange-600 font-bold text-xs">HS</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">HubSpot</p>
        <p className="text-xs text-slate-500">
          {status === null ? 'Checking connection...' : status.connected
            ? `Connected${status.hub_id ? ` · Account ${status.hub_id}` : ''}`
            : status.setup_required ? 'OAuth app setup required' : 'Not connected'}
        </p>
        {message && <p role="status" className="text-xs text-slate-600 mt-1">{message}</p>}
      </div>
      {status && (status.connected ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={working}>Test</Button>
          {status.mode === 'oauth' && <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={working}>Disconnect</Button>}
        </div>
      ) : (
        <Button size="sm" onClick={handleConnect} disabled={working || status.setup_required}>Connect</Button>
      ))}
    </div>
  );
}

export default function Integrations() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connect external platforms to sync your project and call data.</p>
      </div>

      {/* Monday.com OAuth */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Connected Apps</p>
        <MondayConnectCard />
        <HubSpotConnectCard />
      </div>

      {/* Coming soon */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Coming Soon</p>
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <Clock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">More integrations coming soon</p>
          <p className="text-xs text-slate-400 mt-1">Salesforce, Slack, and more are on the way.</p>
        </div>
      </div>
    </div>
  );
}
