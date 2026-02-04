-- Crunch Time: The Ghost-Commit Simulator
-- Database schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_game_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phase TEXT NOT NULL DEFAULT 'LOBBY',
  grid JSONB NOT NULL DEFAULT '[]',
  grid_width INT NOT NULL DEFAULT 20,
  grid_height INT NOT NULL DEFAULT 15,
  tick_count INT NOT NULL DEFAULT 0,
  max_ticks INT NOT NULL DEFAULT 300,
  feature_progress FLOAT NOT NULL DEFAULT 0,
  target_commits INT NOT NULL DEFAULT 50,
  total_commits INT NOT NULL DEFAULT 0,
  outcome TEXT,
  logs TEXT[] DEFAULT '{}',
  events JSONB DEFAULT '[]',
  current_actor_name TEXT,
  current_actor_state TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Game agents table
CREATE TABLE IF NOT EXISTS game_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  x INT NOT NULL DEFAULT 0,
  y INT NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'coding',
  commits INT NOT NULL DEFAULT 0,
  has_headphones BOOLEAN DEFAULT false,
  speed_multiplier FLOAT DEFAULT 1.0,
  last_action_tick INT DEFAULT 0,
  coffee_time INT DEFAULT 0,
  force_push_count INT DEFAULT 0,
  UNIQUE(game_id, user_id)
);

-- Lobby table
CREATE TABLE IF NOT EXISTS lobby (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for server-side access with service role key
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on game_agents" ON game_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lobby" ON lobby FOR ALL USING (true) WITH CHECK (true);
