-- 003: topics + topic_candidates + topic_candidate_votes
-- 참조: docs/ERD_v0.md §4.2~§4.4

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category topic_category NOT NULL,
  format topic_format NOT NULL DEFAULT 'pro_con',
  status topic_status NOT NULL DEFAULT 'candidate',
  cycle_starts_at timestamptz NOT NULL,
  cycle_ends_at timestamptz NOT NULL,
  opinion_window_starts_at timestamptz NOT NULL,
  opinion_window_ends_at timestamptz NOT NULL,
  vote_window_starts_at timestamptz NOT NULL,
  vote_window_ends_at timestamptz NOT NULL,
  comment_window_ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topics_cycle_valid CHECK (cycle_starts_at < cycle_ends_at),
  CONSTRAINT topics_opinion_window_valid CHECK (opinion_window_starts_at >= cycle_starts_at),
  CONSTRAINT topics_opinion_before_vote CHECK (opinion_window_ends_at < vote_window_starts_at),
  CONSTRAINT topics_vote_before_comment_end CHECK (vote_window_ends_at <= comment_window_ends_at),
  CONSTRAINT topics_comment_within_cycle CHECK (comment_window_ends_at <= cycle_ends_at)
);

-- 동시에 active 1개만
CREATE UNIQUE INDEX one_active_topic_idx
  ON public.topics ((true)) WHERE status = 'active';

CREATE INDEX topics_status_cycle_idx
  ON public.topics (status, cycle_starts_at DESC);

CREATE INDEX topics_category_idx
  ON public.topics (category);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- topic_candidates (다음 주 주제 투표 후보, F2)
----------------------------------------------------------
CREATE TABLE public.topic_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  voting_round date NOT NULL,
  voting_starts_at timestamptz NOT NULL,
  voting_ends_at timestamptz NOT NULL,
  vote_count int NOT NULL DEFAULT 0,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_candidates_unique UNIQUE (topic_id, voting_round),
  CONSTRAINT topic_candidates_window_valid CHECK (voting_ends_at > voting_starts_at)
);

CREATE INDEX topic_candidates_round_idx
  ON public.topic_candidates (voting_round, vote_count DESC);

ALTER TABLE public.topic_candidates ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- topic_candidate_votes (1인 1표, F2)
----------------------------------------------------------
CREATE TABLE public.topic_candidate_votes (
  id bigserial PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.topic_candidates(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voting_round date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_candidate_votes_unique UNIQUE (voter_id, voting_round)
);

CREATE INDEX topic_candidate_votes_candidate_idx
  ON public.topic_candidate_votes (candidate_id);

ALTER TABLE public.topic_candidate_votes ENABLE ROW LEVEL SECURITY;

-- 트리거: 후보 투표 INSERT/DELETE 시 vote_count 동기화
CREATE OR REPLACE FUNCTION public.sync_topic_candidate_vote_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topic_candidates
      SET vote_count = vote_count + 1
      WHERE id = NEW.candidate_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topic_candidates
      SET vote_count = GREATEST(0, vote_count - 1)
      WHERE id = OLD.candidate_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER topic_candidate_vote_count_sync
  AFTER INSERT OR DELETE ON public.topic_candidate_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_topic_candidate_vote_count();
