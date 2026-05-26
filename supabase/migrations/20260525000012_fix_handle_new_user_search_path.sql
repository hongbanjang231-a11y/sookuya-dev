-- 012: handle_new_user 트리거의 search_path에 extensions 추가
--
-- 배경:
--   Supabase에서 pgcrypto extension의 함수(digest, gen_random_bytes 등)는
--   `extensions` 스키마에 설치된다. 그런데 handle_new_user는
--   SET search_path = public 으로 고정되어 있어 digest()를 찾지 못한다.
--
-- 증상:
--   auth.users INSERT 시
--   ERROR: 42883 function digest(text, unknown) does not exist
--
-- 수정:
--   search_path 에 extensions 추가. 기능 동작은 동일.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  c_salt CONSTANT text := 'sookuya_v0_2026_05_25';
  v_provider auth_provider;
  v_provider_id text;
  v_email text;
  v_email_hash text;
  v_seed text;
  v_nickname text;
BEGIN
  v_provider := (NEW.raw_app_meta_data->>'provider')::auth_provider;
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
