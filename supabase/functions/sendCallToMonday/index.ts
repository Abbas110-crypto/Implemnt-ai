import { getMondayAccessToken, mondayGraphql } from '../_shared/monday.ts';
import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

function chooseLabel(labels: string[], choices: string[]) {
  return labels.find((label) => choices.some((choice) => label.toLowerCase().includes(choice)));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json();
    const token = await getMondayAccessToken(auth.user.id);

    if (body.action === 'get_options') {
      const { boards = [] } = await mondayGraphql(token, `query {
        boards(limit: 30) {
          id name columns { id title type settings }
          items_page(limit: 200) { items { id name } }
        }
      }`);
      const { users = [] } = await mondayGraphql(token, '{ users { id name } }');
      const normalizedBoards = boards.map((board: any) => ({
        id: board.id,
        name: board.name,
        items: (board.items_page?.items || []).map((item: any) => ({ id: item.id, name: item.name })),
        columns: (board.columns || []).map((column: any) => {
          let labels: string[] = [];
          if (column.type === 'color' || column.type === 'status') {
            const settings = column.settings || {};
            if (Array.isArray(settings.labels)) labels = settings.labels.map((label: any) => label.label).filter(Boolean);
          }
          return { id: column.id, title: column.title, type: column.type, labels };
        }),
      }));
      return jsonResponse({ boards: normalizedBoards, users });
    }

    if (body.action === 'auto_fill') {
      const { call_log_id, status_labels = [], priority_labels = [], item_id, timeline_col_id, timeline_col_type } = body;
      if (!call_log_id) return jsonResponse({ error: 'call_log_id required' }, 400);
      const { data: callLog, error } = await auth.userClient.from('call_logs').select('*').eq('id', call_log_id).single();
      if (error || !callLog) return jsonResponse({ error: 'Call not found' }, 404);

      let currentTimeline: { from?: string; to?: string } | null = null;
      if (item_id && timeline_col_id && /^\d+$/.test(String(item_id))) {
        const safeColumnId = JSON.stringify(String(timeline_col_id));
        try {
          const { items = [] } = await mondayGraphql(token, `query { items(ids: [${item_id}]) { column_values(ids: [${safeColumnId}]) { text value } } }`);
          const value = items[0]?.column_values?.[0]?.value;
          if (value) {
            const parsed = JSON.parse(value);
            currentTimeline = timeline_col_type === 'date'
              ? { from: parsed.date || '', to: '' }
              : { from: parsed.from || parsed.start || '', to: parsed.to || parsed.end || '' };
          }
        } catch (error) {
          console.warn('Could not read the current Monday timeline:', error);
        }
      }

      const risks = Array.isArray(callLog.risk_flags) ? callLog.risk_flags : [];
      const highestRisk = risks.some((risk: any) => risk.severity === 'high') ? 'high'
        : risks.some((risk: any) => risk.severity === 'medium') ? 'medium'
          : risks.length ? 'low' : '';
      const status = highestRisk
        ? chooseLabel(status_labels, ['blocked', 'at risk', 'delayed', 'behind', 'needs attention'])
        : callLog.sentiment === 'positive' ? chooseLabel(status_labels, ['on track', 'complete', 'good', 'green']) : undefined;
      const priority = highestRisk
        ? chooseLabel(priority_labels, highestRisk === 'high' ? ['critical', 'urgent', 'high'] : ['high', 'medium'])
        : undefined;
      const today = new Date();
      const from = currentTimeline?.from || addDays(today, 1);
      const to = currentTimeline?.to
        ? addDays(new Date(`${currentTimeline.to}T00:00:00`), highestRisk ? 7 : 0)
        : addDays(today, highestRisk ? 14 : 28);
      const reasoning = highestRisk
        ? `Configured risk keywords matched the call (${highestRisk} severity); the rule suggests a follow-up date ${highestRisk === 'high' ? 'one week later' : 'two weeks from today'}.`
        : 'No configured risk keywords matched. The suggested follow-up window is four weeks from today.';
      return jsonResponse({ ok: true, suggestions: { status: status || '', priority: priority || '', timeline_from: from, timeline_to: to, reasoning }, current_timeline: currentTimeline });
    }

    if (body.action === 'send') {
      const { call_log_id, board_id, item_id, item_name, status, priority, timeline, assignee } = body;
      if (!call_log_id || !board_id || !/^\d+$/.test(String(board_id))) return jsonResponse({ error: 'call_log_id and a valid board_id are required' }, 400);
      const { data: callLog, error } = await auth.userClient.from('call_logs').select('*').eq('id', call_log_id).single();
      if (error || !callLog) return jsonResponse({ error: 'Call not found' }, 404);

      let targetItemId = item_id || (String(callLog.monday_board_id) === String(board_id) ? callLog.monday_item_id : null);
      if (!targetItemId) {
        const title = String(item_name || callLog.title || 'Call Follow-up').slice(0, 250);
        const created = await mondayGraphql(token, `mutation { create_item(board_id: ${board_id}, item_name: ${JSON.stringify(title)}, create_labels_if_missing: true) { id } }`);
        targetItemId = created.create_item?.id;
        if (targetItemId) {
          const { error: saveError } = await auth.userClient.from('call_logs').update({
            monday_item_id: String(targetItemId), monday_board_id: String(board_id),
          }).eq('id', call_log_id);
          if (saveError) throw saveError;
        }
      }
      if (!targetItemId || !/^\d+$/.test(String(targetItemId))) return jsonResponse({ error: 'Could not find or create Monday item' }, 400);

      if (status?.col_id && status?.value) {
        await mondayGraphql(token, `mutation { change_simple_column_value(item_id: ${targetItemId}, board_id: ${board_id}, column_id: ${JSON.stringify(status.col_id)}, value: ${JSON.stringify(status.value)}, create_labels_if_missing: true) { id } }`);
      }
      if (priority?.col_id && priority?.value) {
        await mondayGraphql(token, `mutation { change_simple_column_value(item_id: ${targetItemId}, board_id: ${board_id}, column_id: ${JSON.stringify(priority.col_id)}, value: ${JSON.stringify(priority.value)}, create_labels_if_missing: true) { id } }`);
      }
      if (timeline?.col_id && timeline?.from) {
        const value = timeline.type === 'date'
          ? JSON.stringify({ date: timeline.from })
          : JSON.stringify({ from: timeline.from, to: timeline.to || timeline.from });
        await mondayGraphql(token, `mutation { change_column_value(item_id: ${targetItemId}, board_id: ${board_id}, column_id: ${JSON.stringify(timeline.col_id)}, value: ${JSON.stringify(value)}) { id } }`);
      }
      if (assignee?.col_id && assignee?.user_id && /^\d+$/.test(String(assignee.user_id))) {
        const peopleValue = JSON.stringify({ personsAndTeams: [{ id: Number(assignee.user_id), kind: 'person' }] });
        await mondayGraphql(token, `mutation { change_column_value(item_id: ${targetItemId}, board_id: ${board_id}, column_id: ${JSON.stringify(assignee.col_id)}, value: ${JSON.stringify(peopleValue)}) { id } }`);
      }

      const note = [`Call: ${callLog.title || 'Call'}`, callLog.call_date ? `Date: ${callLog.call_date}` : '', callLog.summary || callLog.notes || '',
        ...(callLog.risk_flags || []).map((risk: any) => `Risk (${risk.severity}): ${risk.keyword} — ${risk.context}`),
        ...(callLog.action_items || []).map((item: any) => `Follow-up: ${item.action}`),
      ].filter(Boolean).join('\n\n');
      await mondayGraphql(token, `mutation { create_update(item_id: ${targetItemId}, body: ${JSON.stringify(note)}) { id } }`);
      const { account } = await mondayGraphql(token, '{ account { slug } }').catch(() => ({ account: null }));
      const accountSlug = account?.slug || '';
      const { error: updateError } = await auth.userClient.from('call_logs').update({
        monday_item_id: String(targetItemId), monday_board_id: String(board_id), monday_account_slug: accountSlug,
      }).eq('id', call_log_id);
      if (updateError) throw updateError;
      return jsonResponse({ ok: true, monday_item_id: String(targetItemId), monday_board_id: String(board_id), monday_account_slug: accountSlug });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Monday call sync failed:', error);
    return jsonResponse({ error: error.message || 'Could not sync call to Monday.com' }, 500);
  }
});
