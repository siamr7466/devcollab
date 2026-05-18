-- Run this in your Supabase SQL Editor to add expertise and social links to profiles

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
