-- 004: opinions + opinion_votes + 트리거
-- 참조: docs/ERD_v0.md §4.5~§4.6

CREATE TABLE public.opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  status content_status NOT NULL DEFAULT 'published',
  rejection_reason text,
  agree_count int NOT NULL DEFAULT 0,
  disagree_count int NOT NULL DEFAULT 0,
  unsure_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opinions_one_per_user_per_topic UNIQUE (topic_id, author_id),
  CONSTRAINT opinions_body_length CHECK (char_length(body) BETWEEN 100 AND 300),
  CONSTRAINT opinions_rejection_reason_required
    CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX opinions_topic_ranking_idx
  ON public.opinions (topic_id, status, agree_count DESC);

CREATE INDEX opinions_author_idx
  ON public.opinions (author_id, created_at DESC);

CREATE TRIGGER opinions_updated_at
  BEFORE UPDATE ON public.opinions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.opinions ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- opinion_votes
----------------------------------------------------------
CREATE TABLE public.opinion_votes (
  id bigserial PRIMARY KEY,
  opinion_id uuid NOT NULL REFERENCES public.opinions(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote opinion_vote_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opinion_votes_one_per_user_per_opinion UNIQUE (opinion_id, voter_id)
);

CREATE INDEX opinion_votes_opinion_idx
  ON public.opinion_votes (opinion_id);

CREATE TRIGGER opinion_votes_updated_at
  BEFORE UPDATE ON public.opinion_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.opinion_votes ENABLE ROW LEVEL SECURITY;

-- 자기 의견 투표 차단
CREATE OR REPLACE FUNCTION public.prevent_self_vote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.opinions
             WHERE id = NEW.opinion_id AND author_id = NEW.voter_id) THEN
    RAISE EXCEPTION '자기 의견에는 투표할 수 없습니다';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_self_vote_trigger
  BEFORE INSERT ON public.opinion_votes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_vote();

-- 투표 카운트 동기화
CREATE OR REPLACE FUNCTION public.sync_opinion_vote_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_opinion uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.opinions
      SET agree_count = agree_count + CASE WHEN NEW.vote = 'agree' THEN 1 ELSE 0 END,
          disagree_count = disagree_count + CASE WHEN NEW.vote = 'disagree' THEN 1 ELSE 0 END,
          unsure_count = unsure_count + CASE WHEN NEW.vote = 'unsure' THEN 1 ELSE 0 END
      WHERE id = NEW.opinion_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.vote = OLD.vote THEN
      RETURN NEW;
    END IF;
    UPDATE public.opinions
      SET agree_count = agree_count
            + CASE WHEN NEW.vote = 'agree' THEN 1 ELSE 0 END
            - CASE WHEN OLD.vote = 'agree' THEN 1 ELSE 0 END,
          disagree_count = disagree_count
            + CASE WHEN NEW.vote = 'disagree' THEN 1 ELSE 0 END
            - CASE WHEN OLD.vote = 'disagree' THEN 1 ELSE 0 END,
          unsure_count = unsure_count
            + CASE WHEN NEW.vote = 'unsure' THEN 1 ELSE 0 END
            - CASE WHEN OLD.vote = 'unsure' THEN 1 ELSE 0 END
      WHERE id = NEW.opinion_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.opinions
      SET agree_count = GREATEST(0, agree_count - CASE WHEN OLD.vote = 'agree' THEN 1 ELSE 0 END),
          disagree_count = GREATEST(0, disagree_count - CASE WHEN OLD.vote = 'disagree' THEN 1 ELSE 0 END),
          unsure_count = GREATEST(0, unsure_count - CASE WHEN OLD.vote = 'unsure' THEN 1 ELSE 0 END)
      WHERE id = OLD.opinion_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER opinion_votes_count_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.opinion_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_opinion_vote_counts();
