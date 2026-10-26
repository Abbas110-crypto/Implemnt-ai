import { supabase } from '@/lib/supabaseClient';

const entityTables = {
  ActionItem: 'action_items',
  CallLog: 'call_logs',
  Client: 'clients',
  CRMIntegration: 'crm_integrations',
  ExecutiveSummaryConfig: 'executive_summary_configs',
  GongCall: 'gong_calls',
  Milestone: 'milestones',
  MilestoneComment: 'milestone_comments',
  MondayConnection: 'monday_connections',
  ProjectTemplate: 'project_templates',
  RecallCalendar: 'recall_calendars',
  RecallCalendarEvent: 'recall_calendar_events',
  RiskKeyword: 'risk_keywords',
};

function throwIfError(error) {
  if (error) throw error;
}

function mapOrderField(field = 'created_date') {
  return field === 'created_date' ? 'created_date' : field;
}

function applyFilters(query, filters = {}) {
  return Object.entries(filters).reduce((currentQuery, [field, value]) => {
    if (value === null) return currentQuery.is(field, null);
    if (Array.isArray(value)) return currentQuery.in(field, value);
    return currentQuery.eq(field, value);
  }, query);
}

function ordered(query, orderBy) {
  if (!orderBy) return query;
  const descending = orderBy.startsWith('-');
  const column = mapOrderField(descending ? orderBy.slice(1) : orderBy);
  return query.order(column, { ascending: !descending, nullsFirst: false });
}

function entityClient(entityName) {
  const table = entityTables[entityName];
  if (!table) throw new Error(`Unknown data collection: ${entityName}`);

  return {
    async list(orderBy, limit) {
      let query = ordered(supabase.from(table).select('*'), orderBy);
      if (Number.isFinite(limit)) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data ?? [];
    },
    async filter(filters = {}, orderBy, limit) {
      let query = ordered(applyFilters(supabase.from(table).select('*'), filters), orderBy);
      if (Number.isFinite(limit)) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data ?? [];
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      throwIfError(error);
      return data;
    },
    async create(values) {
      const { data, error } = await supabase.from(table).insert(values).select().single();
      throwIfError(error);
      return data;
    },
    async bulkCreate(values) {
      if (!values?.length) return [];
      const { data, error } = await supabase.from(table).insert(values).select();
      throwIfError(error);
      return data ?? [];
    },
    async update(id, values) {
      const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single();
      throwIfError(error);
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwIfError(error);
      return { success: true };
    },
  };
}

export const appClient = {
  entities: new Proxy({}, {
    get: (_target, entityName) => entityClient(entityName),
  }),
  functions: {
    async invoke(name, body = {}) {
      const { data, error } = await supabase.functions.invoke(name, { body });
      return { data, error };
    },
  },
  auth: {
    async me() {
      const { data: { user }, error } = await supabase.auth.getUser();
      throwIfError(error);
      if (!user) throw new Error('Not signed in');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      throwIfError(profileError);

      return { ...user, ...user.user_metadata, ...profile, id: user.id, email: user.email };
    },
    async isAuthenticated() {
      const { data: { session }, error } = await supabase.auth.getSession();
      throwIfError(error);
      return Boolean(session);
    },
    async logout(redirect = false) {
      const { error } = await supabase.auth.signOut();
      throwIfError(error);
      if (redirect) window.location.assign('/');
    },
    async redirectToLogin(returnTo) {
      const destination = new URL('/login', window.location.origin);
      if (returnTo) destination.searchParams.set('next', new URL(returnTo, window.location.origin).pathname);
      window.location.assign(destination.toString());
    },
    async updateMe(values) {
      const { data: { user }, error } = await supabase.auth.getUser();
      throwIfError(error);
      if (!user) throw new Error('Not signed in');

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', user.id)
        .select()
        .single();
      throwIfError(updateError);
      return data;
    },
  },
};
