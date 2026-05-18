-- Run this in your Supabase SQL Editor to add collaboration logic columns

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.project_members 
ADD COLUMN IF NOT EXISTS leader_approved BOOLEAN DEFAULT FALSE;
