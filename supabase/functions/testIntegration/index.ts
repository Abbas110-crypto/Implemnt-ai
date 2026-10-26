import { getMondayAccessToken, mondayGraphql } from '../_shared/monday.ts';
import { isOptions, jsonResponse, preflightResponse, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (isOptions(req)) return preflightResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const { platform } = await req.json();
    if (platform !== 'monday') return jsonResponse({ success: false, error: 'Only Monday.com is currently supported for connection tests.' });
    const token = await getMondayAccessToken(auth.user.id);
    const { me, boards = [] } = await mondayGraphql(token,
      '{ me { id name account { name } } boards(limit: 50) { id name } users { id } }');
    return jsonResponse({
      success: true,
      user_name: me?.name || '',
      account_name: me?.account?.name || '',
      board_count: boards.length,
      boards: boards.map((board: { id: string; name: string }) => ({ id: board.id, name: board.name })),
    });
  } catch (error) {
    console.error('Monday connection test failed:', error);
    return jsonResponse({ success: false, error: error.message || 'Monday.com test failed' }, 500);
  }
});
