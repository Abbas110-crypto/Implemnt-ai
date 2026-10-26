import { getMondayAccessToken, mondayGraphql } from '../_shared/monday.ts';
import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const { query = '' } = await req.json().catch(() => ({}));
    const token = await getMondayAccessToken(auth.user.id);
    const { boards = [] } = await mondayGraphql(token, `query { boards(limit: 50) { id name items_count } }`);
    const keywords = ['contact', 'crm', 'customer', 'lead', 'client'];
    let targets = boards.filter((board: { name: string }) => keywords.some((word) => board.name?.toLowerCase().includes(word)));
    if (!targets.length) targets = boards.filter((board: { items_count: number }) => board.items_count > 0).slice(0, 5);
    const ids = targets.map((board: { id: string }) => board.id).filter((id: string) => /^\d+$/.test(id));
    if (!ids.length) return jsonResponse({ results: [] });

    const { boards: resultBoards = [] } = await mondayGraphql(token, `query { boards(ids: [${ids.join(',')}]) { id name items_page(limit: 100) { items { id name column_values { id type text } } } } }`);
    const results = resultBoards.flatMap((board: any) => (board.items_page?.items || []).map((item: any) => {
      const email = item.column_values?.find((column: any) => column.type === 'email' || column.id?.toLowerCase().includes('email'));
      const phone = item.column_values?.find((column: any) => column.type === 'phone' || column.id?.toLowerCase().includes('phone'));
      return { id: `item_${item.id}`, monday_id: String(item.id), name: item.name, subtitle: board.name, email: email?.text || '', phone: phone?.text || '' };
    }));
    const normalizedQuery = String(query).trim().toLowerCase();
    const filtered = normalizedQuery
      ? results.filter((item: any) => `${item.name} ${item.subtitle} ${item.email}`.toLowerCase().includes(normalizedQuery))
      : results;
    return jsonResponse({ results: filtered });
  } catch (error) {
    console.error('Monday contact search failed:', error);
    return jsonResponse({ error: error.message || 'Monday contact search failed', results: [] }, 500);
  }
});
