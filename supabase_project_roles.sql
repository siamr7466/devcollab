-- Run this in your Supabase SQL Editor to add roles to project members

ALTER TABLE public.project_members 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'contributor';
