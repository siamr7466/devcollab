-- Run this in your Supabase SQL Editor to add media support to project updates

ALTER TABLE public.project_updates ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
ALTER TABLE public.project_updates ADD COLUMN IF NOT EXISTS media_url TEXT;
