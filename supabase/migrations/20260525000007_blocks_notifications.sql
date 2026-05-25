-- 007: user_blocks + notifications + notification_preferences
-- 참조: docs/ERD_v0.md §4.13~§4.15

CREATE TABLE public.user_blocks (
  id bigserial PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX user_blocks_blocker_idx
  ON public.user_blocks (blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- notifications
----------------------------------------------------------
CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  target_type text,
  target_id uuid,
  payload jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- notification_preferences (1인 1행, lazy create — app layer)
----------------------------------------------------------
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_on_opinion boolean NOT NULL DEFAULT true,
  top_opinion boolean NOT NULL DEFAULT true,
  top_comment boolean NOT NULL DEFAULT true,
  report_published boolean NOT NULL DEFAULT true,
  next_topic_voting boolean NOT NULL DEFAULT false,
  push_subscription jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
