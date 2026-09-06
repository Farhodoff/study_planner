-- Migration: Telegram Group Quiz Battle Schema
-- Supports group registration, automatic 2-hour quiz polls, and live group member leaderboard

-- 1. Telegram Groups table
CREATE TABLE IF NOT EXISTS public.telegram_groups (
    chat_id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    chat_type TEXT NOT NULL DEFAULT 'group',
    is_active BOOLEAN NOT NULL DEFAULT true,
    interval_hours INT NOT NULL DEFAULT 2,
    last_quiz_at TIMESTAMPTZ,
    total_quizzes_sent INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast active group lookup
CREATE INDEX IF NOT EXISTS idx_telegram_groups_active ON public.telegram_groups(is_active, last_quiz_at);

-- 2. Telegram Group Active Polls table (maps Telegram Poll IDs to correct answers)
CREATE TABLE IF NOT EXISTS public.telegram_group_polls (
    poll_id TEXT PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    question_id INT NOT NULL,
    correct_option_id INT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_group_polls_chat ON public.telegram_group_polls(chat_id);

-- 3. Telegram Group Scores table (member leaderboard per group)
CREATE TABLE IF NOT EXISTS public.telegram_group_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    user_name TEXT NOT NULL,
    username TEXT,
    score INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    last_answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_telegram_group_user UNIQUE (chat_id, user_id)
);

-- Composite index for fast leaderboard ordering
CREATE INDEX IF NOT EXISTS idx_telegram_group_scores_leaderboard 
ON public.telegram_group_scores(chat_id, score DESC, correct_count DESC);

-- Enable Row Level Security
ALTER TABLE public.telegram_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_group_scores ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service role and serverless API
DROP POLICY IF EXISTS "Allow service role full access to telegram_groups" ON public.telegram_groups;
CREATE POLICY "Allow service role full access to telegram_groups" 
ON public.telegram_groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to telegram_group_polls" ON public.telegram_group_polls;
CREATE POLICY "Allow service role full access to telegram_group_polls" 
ON public.telegram_group_polls FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access to telegram_group_scores" ON public.telegram_group_scores;
CREATE POLICY "Allow service role full access to telegram_group_scores" 
ON public.telegram_group_scores FOR ALL USING (true) WITH CHECK (true);

-- Explicit grants
GRANT ALL ON public.telegram_groups TO postgres, service_role;
GRANT ALL ON public.telegram_group_polls TO postgres, service_role;
GRANT ALL ON public.telegram_group_scores TO postgres, service_role;

