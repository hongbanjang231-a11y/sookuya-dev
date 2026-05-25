-- 008: conclusion_reports (주간 결론 리포트, F8)
-- 참조: docs/ERD_v0.md §4.9
-- 발행 주체: Vercel Cron (D-Q4)

CREATE TABLE public.conclusion_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL UNIQUE REFERENCES public.topics(id) ON DELETE CASCADE,
  published_at timestamptz NOT NULL DEFAULT now(),
  top_opinion_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  divisive_opinion_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  top_comment_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  hall_of_fame_user_id uuid REFERENCES public.profiles(id),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_card_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conclusion_reports_published_idx
  ON public.conclusion_reports (published_at DESC);

ALTER TABLE public.conclusion_reports ENABLE ROW LEVEL SECURITY;
