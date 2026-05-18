-- Run this in your Supabase SQL Editor to fix the Project creation issue

-- 1. Drop old, broken policies on the projects table
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
    END LOOP;
END $$;

-- 2. Ensure RLS is enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Create fresh, correct policies using the new user_id column
CREATE POLICY "Public readable projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "User can insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "User can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
