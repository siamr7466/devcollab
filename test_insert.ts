import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data: user } = await supabase.from('profiles').select('*').limit(1).single();
  if (!user) return console.log("No users found");

  const { data, error } = await supabase.from('projects').insert([
    {
      title: 'Debug Project',
      description: 'Testing creation',
      tags: ['test'],
      user_id: user.id
    }
  ]).select();
  
  if (error) {
    console.error("INSERT ERROR:", error);
  } else {
    console.log("SUCCESS:", data);
  }
}

test();
