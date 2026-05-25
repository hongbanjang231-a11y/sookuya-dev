-- 002: profiles + 닉네임 자동 생성·변경 규칙
-- 참조: docs/ERD_v0.md §4.1, docs/nickname-rule.md

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider auth_provider NOT NULL,
  provider_id text NOT NULL,
  email citext NOT NULL,
  email_hash text NOT NULL,
  nickname text NOT NULL,
  nickname_changed boolean NOT NULL DEFAULT false,
  nickname_changed_at timestamptz,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_provider_provider_id_unique UNIQUE (provider, provider_id),
  CONSTRAINT profiles_email_hash_unique UNIQUE (email_hash),
  CONSTRAINT profiles_nickname_unique UNIQUE (nickname),
  CONSTRAINT profiles_nickname_length CHECK (char_length(nickname) BETWEEN 2 AND 20)
);

COMMENT ON TABLE public.profiles IS '사용자 도메인 프로필 (auth.users 1:1 확장). PRD F7, D2 어뷰징 방지 적용.';
COMMENT ON COLUMN public.profiles.email_hash IS 'sha256(lower(email)) hex. D2 어뷰징 방지용 UNIQUE 키.';

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 닉네임 생성: sha256 시드에서 hex 4자씩 잘라 충돌 회피
CREATE OR REPLACE FUNCTION public.generate_default_nickname(p_seed text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_nickname text;
  v_offset int := 0;
  v_max_attempts int := 16;
BEGIN
  WHILE v_offset < v_max_attempts LOOP
    v_nickname := '숙의야_' || substr(p_seed, v_offset * 4 + 1, 4);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname) THEN
      RETURN v_nickname;
    END IF;
    v_offset := v_offset + 1;
  END LOOP;

  -- 16회 모두 충돌 시 6자로 확장
  LOOP
    v_nickname := '숙의야_' || substr(p_seed, 1, 4) ||
                  lpad(to_hex((random() * 255)::int), 2, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname) THEN
      RETURN v_nickname;
    END IF;
  END LOOP;
END;
$$;

-- 가입 트리거: auth.users INSERT → profiles row 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- TODO: prod 전환 시 별도 secrets로 이전. docs/nickname-rule.md §6.1
  c_salt CONSTANT text := 'sookuya_v0_2026_05_25';
  v_provider auth_provider;
  v_provider_id text;
  v_email text;
  v_email_hash text;
  v_seed text;
  v_nickname text;
BEGIN
  v_provider := (NEW.raw_app_meta_data->>'provider')::auth_provider;
  -- Supabase는 OAuth provider sub를 raw_user_meta_data.provider_id 또는 sub에 저장
  v_provider_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'sub',
    NEW.id::text
  );
  v_email := NEW.email;
  v_email_hash := encode(digest(lower(v_email), 'sha256'), 'hex');
  v_seed := encode(
    digest(
      v_provider::text || ':' || v_provider_id || ':' || v_email_hash || ':' || c_salt,
      'sha256'
    ),
    'hex'
  );
  v_nickname := public.generate_default_nickname(v_seed);

  INSERT INTO public.profiles (id, provider, provider_id, email, email_hash, nickname)
  VALUES (NEW.id, v_provider, v_provider_id, v_email, v_email_hash, v_nickname);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 닉네임 변경 정책 (1회 + 7일 락, D-Q1)
CREATE OR REPLACE FUNCTION public.nickname_cycle_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nickname = OLD.nickname THEN
    RETURN NEW;
  END IF;

  IF OLD.nickname_changed = true THEN
    RAISE EXCEPTION '닉네임은 1회만 변경 가능합니다';
  END IF;

  IF OLD.nickname_changed_at IS NOT NULL
     AND OLD.nickname_changed_at + interval '7 days' > now() THEN
    RAISE EXCEPTION '닉네임 변경 후 7일이 지나지 않았습니다';
  END IF;

  IF NEW.nickname !~ '^[가-힣a-zA-Z0-9_]{2,20}$' THEN
    RAISE EXCEPTION '닉네임 형식이 올바르지 않습니다';
  END IF;
  IF NEW.nickname LIKE '숙의야_%' THEN
    RAISE EXCEPTION '"숙의야_"로 시작하는 닉네임은 사용할 수 없습니다';
  END IF;

  NEW.nickname_changed := true;
  NEW.nickname_changed_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nickname_change_lock
  BEFORE UPDATE OF nickname ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.nickname_cycle_lock();

-- profiles RLS는 009에서 일괄 정의. 일단 활성화만.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
