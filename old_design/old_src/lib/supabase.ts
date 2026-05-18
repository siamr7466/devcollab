import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qplccigdbgyfqzftuuqs.supabase.co';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbGNjaWdkYmd5ZnF6ZnR1dXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODA0NzcsImV4cCI6MjA5NDI1NjQ3N30.z0cwHF4DOUQYITuEqR6I6687FUdCRPGngv2NIdYBeDY';

export const isSupabaseConfigured = !!(
  // @ts-ignore
  (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
);

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing. Check .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
