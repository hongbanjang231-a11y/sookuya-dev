-- 010: 익명용 집계 뷰
-- 참조: docs/ERD_v0.md §5 (D-Q3 익명성)
-- 원본 voter_id는 본인+운영자만 SELECT 가능, 익명/일반 사용자는 집계 결과만 접근

-- 의견별 투표 집계 뷰
CREATE OR REPLACE VIEW public.opinion_vote_counts AS
SELECT
  opinion_id,
  COUNT(*) FILTER (WHERE vote = 'agree')    AS agree_count,
  COUNT(*) FILTER (WHERE vote = 'disagree') AS disagree_count,
  COUNT(*) FILTER (WHERE vote = 'unsure')   AS unsure_count,
  COUNT(*)                                  AS total_count
FROM public.opinion_votes
GROUP BY opinion_id;

COMMENT ON VIEW public.opinion_vote_counts IS
  '의견별 투표 집계. 익명 사용자에게 노출. opinions 캐시 컬럼과 동일 값이지만, 캐시 검증·재계산용 별도 뷰.';

-- 후보별 투표수 (집계 뷰)
CREATE OR REPLACE VIEW public.topic_candidate_vote_counts AS
SELECT
  candidate_id,
  voting_round,
  COUNT(*) AS vote_count
FROM public.topic_candidate_votes
GROUP BY candidate_id, voting_round;

-- 댓글 좋아요 집계 (comments.like_count 캐시와 동일하지만 검증용)
CREATE OR REPLACE VIEW public.comment_like_counts AS
SELECT
  comment_id,
  COUNT(*) AS like_count
FROM public.comment_likes
GROUP BY comment_id;

-- 프로필 공개 뷰 (민감 컬럼 마스킹)
-- profiles의 SELECT RLS는 전체 노출이라, 클라이언트는 가급적 이 뷰를 사용해 닉네임만 가져가도록 권장
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  nickname,
  is_admin,
  created_at
FROM public.profiles;

COMMENT ON VIEW public.profiles_public IS
  '프로필 공개 정보 (닉네임·가입일·운영자 여부만). 클라이언트는 이 뷰 사용 권장. email, email_hash, provider_id 등 민감 컬럼은 노출하지 않음.';

-- view들에 anon/authenticated 권한 부여
GRANT SELECT ON public.opinion_vote_counts TO anon, authenticated;
GRANT SELECT ON public.topic_candidate_vote_counts TO anon, authenticated;
GRANT SELECT ON public.comment_like_counts TO anon, authenticated;
GRANT SELECT ON public.profiles_public TO anon, authenticated;
