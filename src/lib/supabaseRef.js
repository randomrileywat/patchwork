// Holds a module-level reference to the active Supabase client + Clerk user id.
// Set once by AppShell on mount; read by progressStore actions to fire-and-forget upserts
// without threading supabase through every component.

let _client = null;
let _userId = null;

export function setSupabaseRef(client, userId) {
  _client = client;
  _userId = userId;
}

export function clearSupabaseRef() {
  _client = null;
  _userId = null;
}

export function getSupabase() {
  return _client;
}

export function getUserId() {
  return _userId;
}
