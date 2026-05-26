-- 테스트용 더미 user + 의견 시드
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--   (service_role 권한으로 실행되므로 RLS 우회됨)
--
-- 효과:
--   1. 더미 auth user 5명 생성 (kakao provider, seed1~seed5@test.local)
--      → handle_new_user 트리거가 profiles row 자동 생성 (자동 닉네임)
--   2. 가독성을 위해 닉네임을 "토론자A~E"로 변경
--   3. 현재 active 토픽에 각자 다른 입장의 의견 1개씩 등록 (100~300자)
--
-- 롤백:
--   파일 하단의 -- ROLLBACK 블록을 별도로 실행

BEGIN;

DO $$
DECLARE
  v_topic_id uuid;
  v_user_ids uuid[] := ARRAY[
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid()
  ];
  v_emails text[] := ARRAY[
    'seed1@test.local',
    'seed2@test.local',
    'seed3@test.local',
    'seed4@test.local',
    'seed5@test.local'
  ];
  v_nicknames text[] := ARRAY['토론자A', '토론자B', '토론자C', '토론자D', '토론자E'];
  v_opinions text[] := ARRAY[
    '이 주제는 사회적으로 매우 중요한 논의입니다. 단기적인 효율보다 장기적인 지속가능성을 우선해야 한다고 생각합니다. 충분한 공론장과 시민 참여 절차를 거쳐야 결과의 정당성이 확보됩니다. 성급한 결정은 오히려 더 큰 비용을 초래할 수 있습니다.',
    '저는 반대 입장입니다. 현행 제도와 충돌하는 부분이 너무 많아 실제 집행 단계에서 혼란이 클 것입니다. 우선 시범 사업으로 작은 범위에서 검증한 뒤 전국 확대를 논의해야 합니다. 또한 이해관계자 보상 문제도 선결되어야 합니다.',
    '양쪽 입장 모두 일리가 있어 단정하기 어렵습니다. 데이터가 충분하지 않은 상태에서 결론을 내기보다, 영향평가와 비용편익 분석 자료가 공개된 뒤 다시 판단하는 게 좋을 것 같습니다. 그전까지는 신중한 접근이 필요하다고 봅니다.',
    '찬성하는 입장입니다. 기술적·제도적 준비가 이미 상당히 진행되었고, 더 이상 미룰 경우 글로벌 흐름에서 뒤처질 위험이 큽니다. 보완할 부분이 있다면 시행하면서 개선하는 점진적 접근이 현실적이라고 생각합니다.',
    '제도 자체보다 운영 주체의 역량과 투명성이 더 핵심 문제라고 봅니다. 동일한 정책이라도 누가 어떻게 집행하느냐에 따라 결과가 크게 달라집니다. 거버넌스 구조와 감시 메커니즘부터 점검해야 본질적 개선이 가능합니다.'
  ];
  i int;
  v_email_hash text;
  v_seed text;
  v_count int;
BEGIN
  -- 현재 active 토픽 찾기
  SELECT id INTO v_topic_id FROM public.topics WHERE status = 'active' LIMIT 1;
  IF v_topic_id IS NULL THEN
    RAISE EXCEPTION '활성(active) 토픽이 없습니다. 관리자 페이지에서 먼저 토픽을 등록·활성화하세요.';
  END IF;

  FOR i IN 1..5 LOOP
    -- auth.users INSERT → handle_new_user 트리거가 profiles row 생성 (자동 닉네임)
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_ids[i],
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_emails[i],
      '',
      now(),
      jsonb_build_object(
        'provider', 'kakao',
        'providers', jsonb_build_array('kakao')
      ),
      jsonb_build_object(
        'provider_id', 'seed_kakao_' || i,
        'email', v_emails[i]
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- 트리거가 만든 자동 닉네임을 가독성 있는 닉네임으로 교체
    -- (nickname_change_lock 트리거가 nickname_changed=true로 마킹하지만, 시드용이라 OK)
    UPDATE public.profiles
      SET nickname = v_nicknames[i]
      WHERE id = v_user_ids[i];

    -- 의견 작성
    INSERT INTO public.opinions (topic_id, author_id, body, status)
    VALUES (v_topic_id, v_user_ids[i], v_opinions[i], 'published');
  END LOOP;

  SELECT count(*) INTO v_count FROM public.opinions WHERE topic_id = v_topic_id;
  RAISE NOTICE '시드 완료. active 토픽의 총 의견 수: %', v_count;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (시드 데이터 삭제 — 필요 시 별도 실행)
-- ============================================================
-- BEGIN;
-- DELETE FROM auth.users WHERE email IN (
--   'seed1@test.local','seed2@test.local','seed3@test.local',
--   'seed4@test.local','seed5@test.local'
-- );
-- -- auth.users ON DELETE CASCADE → profiles, opinions, opinion_votes 모두 삭제됨
-- COMMIT;
