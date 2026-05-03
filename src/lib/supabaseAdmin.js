// Service-role Supabase client — only imported by Admin.jsx.
// In production GH Pages deploys, leave VITE_SUPABASE_SERVICE_KEY unset; the admin
// route will display a message instead of a working table. Run locally with
// .env populated to access admin features.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

export const supabaseAdmin = serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;
