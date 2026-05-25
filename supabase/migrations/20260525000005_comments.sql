-- 005: comments + comment_likes
-- 참조: docs/ERD_v0.md §4.7~§4.8

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.opinions(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  status content_status NOT NULL DEFAULT 'published',
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_body_length CHECK (char_length(body) BETWEEN 1 AND 200)
);

CREATE INDEX comments_opinion_thread_idx
  ON public.comments (opinion_id, parent_comment_id NULLS FIRST, created_at);

CREATE INDEX comments_author_idx
  ON public.comments (author_id, created_at DESC);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 대댓글 깊이 1 강제 (F5)
CREATE OR REPLACE FUNCTION public.enforce_comment_depth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.comments
               WHERE id = NEW.parent_comment_id
                 AND parent_comment_id IS NOT NULL) THEN
      RAISE EXCEPTION '답글의 답글은 허용되지 않습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_comment_depth_trigger
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_depth();

-- opinions.comment_count 동기화 (status=published만)
CREATE OR REPLACE FUNCTION public.sync_opinion_comment_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
    UPDATE public.opinions
      SET comment_count = comment_count + 1
      WHERE id = NEW.opinion_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'published' AND NEW.status <> 'published' THEN
      UPDATE public.opinions
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = NEW.opinion_id;
    ELSIF OLD.status <> 'published' AND NEW.status = 'published' THEN
      UPDATE public.opinions
        SET comment_count = comment_count + 1
        WHERE id = NEW.opinion_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'published' THEN
    UPDATE public.opinions
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = OLD.opinion_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER comments_count_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_opinion_comment_count();

----------------------------------------------------------
-- comment_likes (F5 — 좋아요만)
----------------------------------------------------------
CREATE TABLE public.comment_likes (
  id bigserial PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);

CREATE INDEX comment_likes_comment_idx
  ON public.comment_likes (comment_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- like_count 동기화
CREATE OR REPLACE FUNCTION public.sync_comment_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments
      SET like_count = like_count + 1
      WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments
      SET like_count = GREATEST(0, like_count - 1)
      WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER comment_likes_count_sync
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_like_count();
