import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let cached = (global as any).__supabase as SupabaseClient | null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  (global as any).__supabase = cached;
  return cached;
}
