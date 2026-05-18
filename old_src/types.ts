export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  unique_id: string;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  user_id: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  media_url: string | null;
  created_at: string;
  profile?: Profile;
};

export type Message = {
  id: string;
  channel_id: string | null;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'voice';
  media_url: string | null;
  created_at: string;
  profile?: Profile;
};
