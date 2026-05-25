-- 011: 사이클 정책 단순화
-- PRD v1.1 D10 (2026-05-25 추가):
--   기존 정책: 화-수 의견 작성, 목-토 투표, 일 22시까지 댓글
--   새 정책: 월 0시 ~ 일 22시 (사이클 전체) 동안 의견·투표·댓글 모두 자유
--
-- 컬럼은 유지하되 (RLS 정책·앱 코드 호환성), 모든 윈도우를 cycle 범위와 동일하게 채운다.
-- strict 순서 CHECK는 제거하고, "cycle 범위 안에만 있으면 OK"라는 느슨한 CHECK로 교체.

-- 1) 기존 strict CHECK 삭제
ALTER TABLE public.topics
  DROP CONSTRAINT IF EXISTS topics_opinion_window_valid,
  DROP CONSTRAINT IF EXISTS topics_opinion_before_vote,
  DROP CONSTRAINT IF EXISTS topics_vote_before_comment_end,
  DROP CONSTRAINT IF EXISTS topics_comment_within_cycle;

-- 2) 느슨한 CHECK 추가 (윈도우는 cycle 범위 안에만 있으면 됨)
ALTER TABLE public.topics
  ADD CONSTRAINT topics_opinion_window_within_cycle
    CHECK (opinion_window_starts_at >= cycle_starts_at
       AND opinion_window_ends_at <= cycle_ends_at
       AND opinion_window_starts_at <= opinion_window_ends_at),
  ADD CONSTRAINT topics_vote_window_within_cycle
    CHECK (vote_window_starts_at >= cycle_starts_at
       AND vote_window_ends_at <= cycle_ends_at
       AND vote_window_starts_at <= vote_window_ends_at),
  ADD CONSTRAINT topics_comment_within_cycle
    CHECK (comment_window_ends_at <= cycle_ends_at
       AND comment_window_ends_at >= cycle_starts_at);

-- 3) 기존 행 마이그레이션: 모든 윈도우 = cycle 전체
UPDATE public.topics
SET
  opinion_window_starts_at = cycle_starts_at,
  opinion_window_ends_at = cycle_ends_at,
  vote_window_starts_at = cycle_starts_at,
  vote_window_ends_at = cycle_ends_at,
  comment_window_ends_at = cycle_ends_at;

COMMENT ON CONSTRAINT topics_opinion_window_within_cycle ON public.topics IS
  '윈도우는 cycle 범위 안에 있어야 함. 정책상 보통 = cycle 전체.';
