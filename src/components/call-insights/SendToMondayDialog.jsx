import React, { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Send, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const NEW_ITEM = '__new__';

export default function SendToMondayDialog({ open, onOpenChange, call, onSent }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');
  const [boardId, setBoardId] = useState('');
  const [itemId, setItemId] = useState(NEW_ITEM);
  const [itemName, setItemName] = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [priorityVal, setPriorityVal] = useState('');
  const [timelineFrom, setTimelineFrom] = useState('');
  const [timelineTo, setTimelineTo] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillReason, setAutoFillReason] = useState('');
  const [currentTimeline, setCurrentTimeline] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setOptions(null);
    setBoardId('');
    appClient.functions.invoke('sendCallToMonday', { action: 'get_options' })
      .then(res => {
        if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || 'Failed to load Monday boards');
        if (!res.data?.boards) throw new Error('Failed to load Monday boards');
        setOptions(res.data);
        if (res.data.boards.length) setBoardId(String(res.data.boards[0].id));
        else setError('No Monday boards are available for this account.');
      })
      .catch(e => setError(e.message || 'Failed to load Monday options'))
      .finally(() => setLoading(false));
  }, [open]);

  // Reset item-level fields when board or call changes
  useEffect(() => {
    setItemId(NEW_ITEM);
    setItemName(call?.title || '');
    setStatusVal('');
    setPriorityVal('');
    setTimelineFrom('');
    setTimelineTo('');
    setAssigneeId('');
    setAutoFillReason('');
    setCurrentTimeline(null);
  }, [boardId, call]);

  // Auto-fill status, priority, timeline from stored call notes and deterministic rules.
  // Re-runs when an existing item is selected so local rules can suggest updates to
  // that item's current project dates.
  useEffect(() => {
    if (!open || !call?.id || !selectedBoard || loading) return;
    if (!statusCol && !priorityCol && !timelineCol) return;

    let cancelled = false;
    setAutoFilling(true);
    setAutoFillReason('');
    setCurrentTimeline(null);

    appClient.functions.invoke('sendCallToMonday', {
      action: 'auto_fill',
      call_log_id: call.id,
      status_labels: statusCol?.labels || [],
      priority_labels: priorityCol?.labels || [],
      item_id: itemId !== NEW_ITEM ? itemId : undefined,
      board_id: boardId,
      timeline_col_id: timelineCol?.id,
      timeline_col_type: timelineCol?.type,
    })
      .then(res => {
        if (cancelled) return;
        const s = res.data?.suggestions;
        if (s) {
          if (s.status) setStatusVal(s.status);
          if (s.priority) setPriorityVal(s.priority);
          if (s.timeline_from) {
            setTimelineFrom(s.timeline_from);
            if (s.timeline_to) setTimelineTo(s.timeline_to);
          }
          if (s.reasoning) setAutoFillReason(s.reasoning);
        }
        if (res.data?.current_timeline) setCurrentTimeline(res.data.current_timeline);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAutoFilling(false); });

    return () => { cancelled = true; };
  }, [open, call?.id, boardId, itemId, loading]);

  const selectedBoard = useMemo(() => options?.boards?.find(b => b.id === boardId), [options, boardId]);

  const statusCol = useMemo(() => selectedBoard?.columns.find(c =>
    (c.type === 'status' || c.type === 'color') && /status|stage|health/i.test(c.title))
    || selectedBoard?.columns.find(c => (c.type === 'status' || c.type === 'color') && !/priority/i.test(c.title)), [selectedBoard]);
  const priorityCol = useMemo(() => selectedBoard?.columns.find(c =>
    (c.type === 'status' || c.type === 'color') && /priority/i.test(c.title)), [selectedBoard]);
  const timelineCol = useMemo(
    () => selectedBoard?.columns.find(c => c.type === 'timeline' || c.type === 'date' || /timeline|date|due/i.test(c.title)),
    [selectedBoard]
  );
  const peopleCol = useMemo(
    () => selectedBoard?.columns.find(c => c.type === 'people' || c.type === 'person' || /assign|owner|user|person|responsible/i.test(c.title)),
    [selectedBoard]
  );

  const handleSend = async () => {
    if (!boardId) { toast.error('Select a board'); return; }
    if (itemId === NEW_ITEM && !itemName.trim()) { toast.error('Enter an item name'); return; }
    setSending(true);
    try {
      const payload = {
        action: 'send',
        call_log_id: call.id,
        board_id: boardId,
        item_id: itemId !== NEW_ITEM ? itemId : undefined,
        item_name: itemId === NEW_ITEM ? itemName : undefined,
        status: statusCol && statusVal ? { col_id: statusCol.id, value: statusVal } : undefined,
        priority: priorityCol && priorityVal ? { col_id: priorityCol.id, value: priorityVal } : undefined,
        timeline: timelineCol && timelineFrom
          ? { col_id: timelineCol.id, type: timelineCol.type, from: timelineFrom, to: timelineTo || undefined }
          : undefined,
        assignee: peopleCol && assigneeId ? { col_id: peopleCol.id, user_id: assigneeId } : undefined,
      };
      const res = await appClient.functions.invoke('sendCallToMonday', payload);
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || 'Failed to send');
      if (res.data?.ok) {
        toast.success('Sent to Monday.com!');
        onSent?.();
        onOpenChange(false);
      } else {
        toast.error(res.data?.error || 'Failed to send');
      }
    } catch (e) {
     toast.error(e.response?.data?.error || e.message || 'Failed to send');
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Monday.com</DialogTitle>
          <DialogDescription>Sync this call's summary and insights to a Monday.com board.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Board / Project */}
            <div>
              <Label className="text-xs text-slate-500">Project (Board)</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select board" /></SelectTrigger>
                <SelectContent>
                  {options?.boards?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Item / Company */}
            <div>
              <Label className="text-xs text-slate-500">Company / Customer (Item)</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_ITEM}>➕ Create new item</SelectItem>
                  {selectedBoard?.items?.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {itemId === NEW_ITEM && (
                <Input className="mt-2" placeholder="Item name" value={itemName} onChange={e => setItemName(e.target.value)} />
              )}
            </div>

            {/* Status */}
            {statusCol && (
              <div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-slate-500">Status</Label>
                  {autoFilling && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                  {!autoFilling && statusVal && <Sparkles className="w-3 h-3 text-indigo-500" />}
                </div>
                <Select value={statusVal} onValueChange={setStatusVal}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {statusCol.labels?.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Priority */}
            {priorityCol && (
              <div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-slate-500">Priority</Label>
                  {autoFilling && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                  {!autoFilling && priorityVal && <Sparkles className="w-3 h-3 text-indigo-500" />}
                </div>
                <Select value={priorityVal} onValueChange={setPriorityVal}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select priority" /></SelectTrigger>
                  <SelectContent>
                    {priorityCol.labels?.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Timeline / Date */}
            {timelineCol && (
              <div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-slate-500">{timelineCol.type === 'date' ? 'Date' : 'Timeline'}</Label>
                  {autoFilling && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                  {!autoFilling && timelineFrom && <Sparkles className="w-3 h-3 text-indigo-500" />}
                </div>
                {currentTimeline && (currentTimeline.from || currentTimeline.to) && (
                  <p className="text-xs text-slate-400 mt-1 mb-1">
                    Current: {currentTimeline.from || '—'}{timelineCol.type !== 'date' && currentTimeline.to ? ` → ${currentTimeline.to}` : ''}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <Input type="date" value={timelineFrom} onChange={e => setTimelineFrom(e.target.value)} />
                  {timelineCol.type !== 'date' && (
                    <Input type="date" value={timelineTo} onChange={e => setTimelineTo(e.target.value)} placeholder="To" />
                  )}
                </div>
                {currentTimeline && (currentTimeline.from || currentTimeline.to) && timelineFrom && (
                  <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Rule-based suggestion — review and adjust before sending
                  </p>
                )}
              </div>
            )}

            {autoFillReason && (statusVal || priorityVal || timelineFrom) && (
              <div className="flex items-start gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{autoFillReason}</span>
              </div>
            )}

            {/* Assignee / User */}
            {peopleCol && (
              <div>
                <Label className="text-xs text-slate-500">User (Assignee)</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {options?.users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!statusCol && !priorityCol && !timelineCol && !peopleCol && (
              <p className="text-xs text-slate-400 italic">No recognizable Status, Priority, Timeline, or Assignee columns found on this board.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || loading || !!error} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send to Monday
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
