import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, profile:profiles!projects_leader_id_fkey(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error("FETCH ERROR:", error);
  } else {
    console.log("SUCCESS:", data?.length, "projects found");
  }
}

test();
