-- Run this in your Supabase SQL Editor to create the project updates table

CREATE TABLE IF NOT EXISTS public.project_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- Allow project members and creators to view updates
CREATE POLICY "Project members can view updates" ON public.project_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = project_updates.project_id
      AND project_members.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_updates.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Allow project members and creators to insert updates
CREATE POLICY "Project members can insert updates" ON public.project_updates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = project_updates.project_id
      AND project_members.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_updates.project_id
      AND projects.user_id = auth.uid()
    )
  );
