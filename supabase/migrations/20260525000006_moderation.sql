-- 006: moderation_rules + reports + user_violations
-- 참조: docs/ERD_v0.md §4.10~§4.12

CREATE TABLE public.moderation_rules (
  id bigserial PRIMARY KEY,
  pattern text NOT NULL,
  rule_type moderation_rule_type NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX moderation_rules_active_type_idx
  ON public.moderation_rules (rule_type, active);

ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- reports (신고)
----------------------------------------------------------
CREATE TABLE public.reports (
  id bigserial PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_unique_per_reporter UNIQUE (reporter_id, target_type, target_id),
  CONSTRAINT reports_resolved_consistency
    CHECK ((status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL)
        OR (status <> 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);

CREATE INDEX reports_pending_idx
  ON public.reports (status, created_at) WHERE status = 'pending';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------
-- user_violations (위반 누적)
----------------------------------------------------------
CREATE TABLE public.user_violations (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_count int NOT NULL DEFAULT 0,
  last_violation_at timestamptz,
  suspended_until timestamptz,
  banned boolean NOT NULL DEFAULT false
);

ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

-- 위반자 작성 차단 헬퍼 함수 (RLS 정책에서 호출)
CREATE OR REPLACE FUNCTION public.is_user_suspended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_violations
    WHERE user_id = p_user_id
      AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))
  );
$$;
