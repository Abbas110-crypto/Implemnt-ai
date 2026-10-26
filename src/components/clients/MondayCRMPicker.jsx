import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { Search, Loader2, X, ChevronDown, User, Building2, ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function MondayCRMPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Load all results once when dropdown opens
  const loadResults = async () => {
    if (allResults !== null) return;
    setLoading(true);
    try {
      const res = await appClient.functions.invoke('searchMondayContacts', { query: '' });
      if (res.data?.error?.includes('not connected')) {
        setNotConnected(true);
        setAllResults([]);
      } else {
        setNotConnected(false);
        setAllResults(res.data?.results || []);
      }
    } catch (e) {
      setNotConnected(true);
      setAllResults([]);
    }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(true);
    loadResults();
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allResults
    ? query.trim()
      ? allResults.filter(r =>
          r.name?.toLowerCase().includes(query.toLowerCase()) ||
          r.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
          r.email?.toLowerCase().includes(query.toLowerCase())
        )
      : allResults
    : [];

  // Group by board name (subtitle)
  const grouped = filtered.reduce((acc, r) => {
    const key = r.subtitle || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const handleSelect = (item) => {
    onChange({
      monday_contact_id: item.monday_id,
      monday_contact_name: item.name,
      monday_contact_email: item.email || '',
      monday_account_name: item.type === 'account' ? item.name : (item.subtitle || ''),
    });
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ monday_contact_id: '', monday_contact_name: '', monday_contact_email: '', monday_account_name: '' });
  };

  const hasValue = !!value?.monday_contact_id;

  return (
    <div ref={containerRef} className="space-y-1 relative">
      <Label className="text-xs">Monday CRM Customer</Label>

      {/* Trigger */}
      <button
        type="button"
        onClick={hasValue ? undefined : handleOpen}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
          hasValue
            ? 'border-red-200 bg-red-50 cursor-default'
            : 'border-input bg-background hover:bg-accent cursor-pointer'
        }`}
      >
        {hasValue ? (
          <>
            <Building2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <span className="font-medium text-slate-800 truncate">{value.monday_contact_name}</span>
              {(value.monday_account_name && value.monday_account_name !== value.monday_contact_name) && (
                <span className="text-slate-400 ml-1.5 text-xs truncate">· {value.monday_account_name}</span>
              )}
              {value.monday_contact_email && (
                <span className="text-slate-400 ml-1.5 text-xs truncate">· {value.monday_contact_email}</span>
              )}
            </div>
            <button onClick={handleClear} className="p-0.5 rounded hover:bg-red-200 text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="flex-1 text-left text-muted-foreground">Link a Monday CRM customer…</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search accounts or contacts…"
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
          </div>

          {notConnected ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Monday.com not connected.</p>
              <a href="/integrations" className="text-xs text-indigo-600 underline flex items-center gap-1 justify-center">
                Connect in Integrations <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : loading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {Object.keys(grouped).length > 0 ? Object.entries(grouped).map(([group, items]) => (
                <React.Fragment key={group}>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                  {items.map(item => (
                    <button key={item.id} type="button" onClick={() => handleSelect(item)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition-colors text-left">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 truncate">{item.name}</p>
                        {item.email && <p className="text-xs text-slate-400 truncate">{item.email}</p>}
                      </div>
                    </button>
                  ))}
                </React.Fragment>
              )) : (
                <p className="text-xs text-slate-400 text-center py-5">
                  {query ? 'No results found' : 'No CRM data found in Monday.com'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
