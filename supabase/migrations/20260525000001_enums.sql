-- 001: ENUM 타입 + 재사용 함수
-- 참조: docs/ERD_v0.md §3

-- pgcrypto는 Supabase 기본 활성화 (digest, gen_random_uuid 등)
-- citext는 명시적으로 활성화
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 가입 경로
CREATE TYPE auth_provider AS ENUM ('kakao', 'naver');

-- 주제 상태
CREATE TYPE topic_status AS ENUM (
  'candidate',
  'voting_next',
  'active',
  'archived'
);

-- 주제 카테고리 (PRD §1.4 화이트리스트)
CREATE TYPE topic_category AS ENUM (
  'society',
  'tech',
  'lifestyle',
  'culture',
  'economy',
  'education',
  'environment'
);

-- 토론 형식 (v0은 pro_con 고정)
CREATE TYPE topic_format AS ENUM ('pro_con', 'score');

-- 콘텐츠 상태
CREATE TYPE content_status AS ENUM (
  'published',
  'pending_review',
  'rejected',
  'deleted'
);

-- 의견 투표 옵션
CREATE TYPE opinion_vote_value AS ENUM ('agree', 'disagree', 'unsure');

-- 신고 대상 종류
CREATE TYPE report_target_type AS ENUM ('opinion', 'comment');

-- 신고 처리 상태
CREATE TYPE report_status AS ENUM (
  'pending',
  'resolved_keep',
  'resolved_remove'
);

-- 룰 종류
CREATE TYPE moderation_rule_type AS ENUM (
  'profanity', 'hate', 'personal_info', 'ad'
);

-- 알림 종류
CREATE TYPE notification_type AS ENUM (
  'comment_on_opinion',
  'top_opinion',
  'top_comment',
  'report_published',
  'next_topic_voting'
);

-- 모든 테이블에서 재사용할 updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
