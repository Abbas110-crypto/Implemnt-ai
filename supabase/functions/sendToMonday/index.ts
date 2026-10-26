import { getMondayAccessToken, mondayGraphql } from '../_shared/monday.ts';
import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const { action, action_item_id, board_id, group_id } = await req.json();
    if (action === 'get_boards') {
      const token = await getMondayAccessToken(auth.user.id);
      const { boards = [] } = await mondayGraphql(token, '{ boards(limit: 50) { id name } }');
      return jsonResponse({ boards });
    }
    if (!action_item_id) return jsonResponse({ error: 'action_item_id required' }, 400);
    const { data: actionItem, error: itemError } = await auth.userClient.from('action_items')
      .select('*').eq('id', action_item_id).single();
    if (itemError || !actionItem) return jsonResponse({ error: 'Action item not found' }, 404);
    if (actionItem.status !== 'approved') return jsonResponse({ error: 'Approve this action item before sending it to Monday.com.' }, 400);
    const token = await getMondayAccessToken(auth.user.id);
    const targetBoardId = board_id || actionItem.monday_board_id;
    if (!targetBoardId) return jsonResponse({ error: 'Choose a Monday board before sending this action item.' }, 400);
    if (!/^\d+$/.test(String(targetBoardId))) return jsonResponse({ error: 'Invalid board ID' }, 400);

    let mondayItemId = String(actionItem.monday_board_id) === String(targetBoardId) ? actionItem.monday_item_id : null;
    let createdNow = false;
    if (!mondayItemId) {
      const groupPart = group_id ? `group_id: ${JSON.stringify(group_id)},` : '';
      const createQuery = `mutation { create_item(board_id: ${targetBoardId}, ${groupPart} item_name: ${JSON.stringify(actionItem.title)}, create_labels_if_missing: true) { id } }`;
      const created = await mondayGraphql(token, createQuery);
      mondayItemId = created.create_item?.id;
      createdNow = true;
    }
    if (!mondayItemId) return jsonResponse({ error: 'Monday.com did not return a new item ID' }, 502);
    const { error: linkError } = await auth.userClient.from('action_items').update({
      monday_item_id: String(mondayItemId), monday_board_id: String(targetBoardId),
    }).eq('id', action_item_id);
    if (linkError) throw linkError;

    let statusUpdated = false;
    let statusWarning: string | null = null;
    let statusRequested = false;
    const keywords = actionItem.triggered_by_keywords || [];
    if (keywords.length) {
      const { data: configuredKeywords, error: keywordsError } = await auth.userClient.from('risk_keywords')
        .select('severity,monday_status_value').eq('tenant_id', auth.user.id).in('keyword', keywords).not('monday_status_value', 'is', null);
      if (keywordsError) throw keywordsError;
      const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const targetStatus = configuredKeywords?.sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)).map((row) => row.monday_status_value).find(Boolean);
      if (targetStatus) {
        statusRequested = true;
        try {
          const { boards = [] } = await mondayGraphql(token, `query { boards(ids: [${targetBoardId}]) { columns { id title type settings } } }`);
          const statusColumn = boards[0]?.columns?.find((column: any) => column.type === 'status');
          const labels = statusColumn?.settings?.labels || [];
          const matchingLabel = labels.find((label: any) => label.label === targetStatus);
          if (!statusColumn) statusWarning = 'Monday item was created, but this board has no Status column.';
          else if (!matchingLabel) statusWarning = `Monday item was created, but “${targetStatus}” is not a label in the board Status column.`;
          else {
            await mondayGraphql(token, `mutation { change_simple_column_value(item_id: ${mondayItemId}, board_id: ${targetBoardId}, column_id: ${JSON.stringify(statusColumn.id)}, value: ${JSON.stringify(targetStatus)}) { id } }`);
            statusUpdated = true;
          }
        } catch (error) {
          statusWarning = `Monday item was created, but its Status was not changed: ${error instanceof Error ? error.message : 'unknown error'}`;
        }
      }
    }

    const details = [
      `Risk category: ${actionItem.risk_category || 'other'}`,
      `Severity: ${actionItem.severity || 'medium'}`,
      `Triggered by: ${(actionItem.triggered_by_keywords || []).join(', ') || 'follow-up rule'}`,
      actionItem.description || '',
      actionItem.context_snippet ? `Call excerpt: ${actionItem.context_snippet}` : '',
    ].filter(Boolean).join('\n\n');
    if (createdNow) await mondayGraphql(token, `mutation { create_update(item_id: ${mondayItemId}, body: ${JSON.stringify(details)}) { id } }`);

    const { error: updateError } = await auth.userClient.from('action_items').update({
      status: statusRequested && !statusUpdated ? actionItem.status : 'sent_to_monday',
      monday_item_id: String(mondayItemId), monday_board_id: String(targetBoardId),
    }).eq('id', action_item_id);
    if (updateError) throw updateError;
    return jsonResponse({ success: true, monday_item_id: String(mondayItemId), board_id: String(targetBoardId), status_updated: statusUpdated, status_warning: statusWarning });
  } catch (error) {
    console.error('Sending action item to Monday failed:', error);
    return jsonResponse({ error: error.message || 'Could not send action item to Monday.com' }, 500);
  }
});
