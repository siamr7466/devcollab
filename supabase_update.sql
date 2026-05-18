-- Run this in your Supabase SQL Editor to add threading and voting to the messages table

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_help_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS upvoted_by UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS downvoted_by UUID[] DEFAULT '{}';

-- Create an index to quickly fetch replies for a specific message
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON public.messages(parent_id);
