-- 009: RLS 정책 일괄
-- 참조: docs/ERD_v0.md §5 RLS 정책 매트릭스
-- 원칙: 기본 거부, 명시 정책만 허용. 익명(anon)/로그인(authenticated)/운영자 분리.

----------------------------------------------------------
-- 헬퍼 함수: 현재 사용자가 운영자인지
----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

----------------------------------------------------------
-- profiles
----------------------------------------------------------
CREATE POLICY profiles_select_public
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);
-- email, email_hash, provider_id 등 민감 컬럼은 010 views.sql에서 마스킹 뷰로 노출.
-- 클라이언트가 profiles 직접 조회 시 민감 컬럼도 보일 수 있어, 앱 layer에서 컬럼 선택 주의.

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_admin_all
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- topics
----------------------------------------------------------
CREATE POLICY topics_select_all
  ON public.topics FOR SELECT
  TO anon, authenticated
  USING (status IN ('active', 'voting_next', 'archived') OR public.is_admin());

CREATE POLICY topics_admin_write
  ON public.topics FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- topic_candidates
----------------------------------------------------------
CREATE POLICY topic_candidates_select_all
  ON public.topic_candidates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY topic_candidates_admin_write
  ON public.topic_candidates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- topic_candidate_votes
----------------------------------------------------------
-- 원본 테이블 SELECT는 본인+운영자만 (집계는 010 뷰에서 모두에게 노출)
CREATE POLICY topic_candidate_votes_select_self
  ON public.topic_candidate_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = voter_id OR public.is_admin());

CREATE POLICY topic_candidate_votes_insert_self
  ON public.topic_candidate_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.topic_candidates tc
      WHERE tc.id = candidate_id
        AND now() BETWEEN tc.voting_starts_at AND tc.voting_ends_at
    )
    AND NOT public.is_user_suspended(auth.uid())
  );

CREATE POLICY topic_candidate_votes_delete_self
  ON public.topic_candidate_votes FOR DELETE
  TO authenticated
  USING (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.topic_candidates tc
      WHERE tc.id = candidate_id
        AND now() < tc.voting_ends_at
    )
  );

----------------------------------------------------------
-- opinions
----------------------------------------------------------
CREATE POLICY opinions_select_published
  ON public.opinions FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR auth.uid() = author_id
    OR public.is_admin()
  );

CREATE POLICY opinions_insert_in_window
  ON public.opinions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.topics t
      WHERE t.id = topic_id
        AND now() BETWEEN t.opinion_window_starts_at AND t.opinion_window_ends_at
    )
    AND NOT public.is_user_suspended(auth.uid())
  );

CREATE POLICY opinions_update_in_window
  ON public.opinions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.topics t
      WHERE t.id = topic_id
        AND now() <= t.opinion_window_ends_at
    )
  )
  WITH CHECK (auth.uid() = author_id);

-- soft delete (status='deleted' UPDATE)는 위 update 정책으로 통과.
-- 운영자 강제 처리
CREATE POLICY opinions_admin_all
  ON public.opinions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- opinion_votes (D-Q3 익명성: voter는 본인+운영자만 SELECT)
----------------------------------------------------------
CREATE POLICY opinion_votes_select_self
  ON public.opinion_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = voter_id OR public.is_admin());

CREATE POLICY opinion_votes_insert_in_window
  ON public.opinion_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.opinions o
      JOIN public.topics t ON t.id = o.topic_id
      WHERE o.id = opinion_id
        AND now() BETWEEN t.vote_window_starts_at AND t.vote_window_ends_at
    )
    AND NOT public.is_user_suspended(auth.uid())
  );

CREATE POLICY opinion_votes_update_self
  ON public.opinion_votes FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.opinions o
      JOIN public.topics t ON t.id = o.topic_id
      WHERE o.id = opinion_id
        AND now() <= t.vote_window_ends_at
    )
  )
  WITH CHECK (auth.uid() = voter_id);

CREATE POLICY opinion_votes_delete_self
  ON public.opinion_votes FOR DELETE
  TO authenticated
  USING (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1 FROM public.opinions o
      JOIN public.topics t ON t.id = o.topic_id
      WHERE o.id = opinion_id
        AND now() <= t.vote_window_ends_at
    )
  );

----------------------------------------------------------
-- comments
----------------------------------------------------------
CREATE POLICY comments_select_published
  ON public.comments FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR auth.uid() = author_id
    OR public.is_admin()
  );

CREATE POLICY comments_insert_in_window
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.opinions o
      JOIN public.topics t ON t.id = o.topic_id
      WHERE o.id = opinion_id
        AND now() <= t.comment_window_ends_at
    )
    AND NOT public.is_user_suspended(auth.uid())
  );

CREATE POLICY comments_update_grace_period
  ON public.comments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id
    AND created_at + interval '5 minutes' > now()
  )
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY comments_admin_all
  ON public.comments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- comment_likes
----------------------------------------------------------
CREATE POLICY comment_likes_select_self
  ON public.comment_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY comment_likes_insert_in_window
  ON public.comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.comments c
      JOIN public.opinions o ON o.id = c.opinion_id
      JOIN public.topics t ON t.id = o.topic_id
      WHERE c.id = comment_id
        AND now() <= t.comment_window_ends_at
    )
    AND NOT public.is_user_suspended(auth.uid())
  );

CREATE POLICY comment_likes_delete_self
  ON public.comment_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

----------------------------------------------------------
-- moderation_rules (운영자만)
----------------------------------------------------------
CREATE POLICY moderation_rules_admin_all
  ON public.moderation_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- reports
----------------------------------------------------------
CREATE POLICY reports_select_own_or_admin
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin());

CREATE POLICY reports_insert_authenticated
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY reports_update_admin
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- user_violations (본인 SELECT, 운영자 전체)
----------------------------------------------------------
CREATE POLICY user_violations_select_self_or_admin
  ON public.user_violations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_violations_admin_write
  ON public.user_violations FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

----------------------------------------------------------
-- user_blocks (본인만)
----------------------------------------------------------
CREATE POLICY user_blocks_select_self
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY user_blocks_insert_self
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY user_blocks_delete_self
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

----------------------------------------------------------
-- notifications (본인만)
----------------------------------------------------------
CREATE POLICY notifications_select_self
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY notifications_update_self
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY notifications_delete_self
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
-- INSERT는 service role만 (RLS bypass)

----------------------------------------------------------
-- notification_preferences (본인만)
----------------------------------------------------------
CREATE POLICY notification_preferences_select_self
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY notification_preferences_insert_self
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY notification_preferences_update_self
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

----------------------------------------------------------
-- conclusion_reports (모두 SELECT, service role만 INSERT/UPDATE)
----------------------------------------------------------
CREATE POLICY conclusion_reports_select_all
  ON public.conclusion_reports FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY conclusion_reports_admin_delete
  ON public.conclusion_reports FOR DELETE
  TO authenticated
  USING (public.is_admin());
-- INSERT/UPDATE는 Vercel Cron의 service role key 호출로 RLS 우회
