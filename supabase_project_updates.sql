-- Run this in your Supabase SQL Editor to add project members functionality

-- 1. Migrate the projects table to the new schema
DO $$ 
BEGIN 
  -- Rename leader_id to user_id if leader_id exists and user_id doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='leader_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='user_id') THEN
    ALTER TABLE public.projects RENAME COLUMN leader_id TO user_id;
  END IF;

  -- Add user_id column if neither existed (just in case)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='user_id') THEN
    ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='status') THEN
    ALTER TABLE public.projects ADD COLUMN status TEXT DEFAULT 'published';
  END IF;

  -- Add tags column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='tags') THEN
    ALTER TABLE public.projects ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;

  -- Add media_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='media_url') THEN
    ALTER TABLE public.projects ADD COLUMN media_url TEXT;
  END IF;
END $$;

-- 2. Create the project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Allow project creators to add members and allow users to read members
CREATE POLICY "Public readable project_members" ON public.project_members FOR SELECT USING (true);

-- Allow project creator to insert members
CREATE POLICY "Project creators can add members" ON public.project_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_members.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow project creator to delete members
CREATE POLICY "Project creators can remove members" ON public.project_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_members.project_id
    AND projects.user_id = auth.uid()
  )
);
