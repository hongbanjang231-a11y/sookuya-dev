# 숙의야 — 닉네임 생성·변경 규칙

**대상:** PRD v1.1 F7 (OAuth 기반 가입) — 자동 닉네임 + 1회 변경
**관련 ERD:** `docs/ERD_v0.md` §4.1 `profiles`
**버전:** v0.1 (2026-05-25)

---

## 1. 닉네임 형식

### 1.1 시스템 자동 생성 (가입 시 기본값)

```
숙의야_xxxx
```

- 접두사: `숙의야_` (고정, 한글 3자 + 언더스코어 = 4자)
- 접미사 `xxxx`: 영숫자 소문자 4자 (`[a-z0-9]`, 16^4 = 65,536 조합 — 단 hex만 쓸 경우 65,536. 본 규칙은 hex 4자 사용)
- 전체 길이: 8자

**예시:** `숙의야_a3f9`, `숙의야_0042`, `숙의야_bd7c`

### 1.2 사용자 직접 입력 (변경 시)

- 길이: **2~20자**
- 허용 문자: 한글(완성형), 영문, 숫자, 언더스코어(`_`)
- 금지: 공백, 특수문자(`!@#$` 등), 이모지, 0-width 문자
- 정규식: `^[가-힣a-zA-Z0-9_]{2,20}$`
- **`숙의야_` 접두사를 사용자가 임의로 쓸 수 없음** (시스템 생성과 혼동 방지) → validation에서 차단

---

## 2. 자동 생성 알고리즘 (가입 트리거)

### 2.1 입력
- `auth.users.id` (uuid)
- `auth.users.email` (text)
- `provider` (kakao | naver)

### 2.2 시드 생성
```
seed = sha256(provider + ':' + provider_id + ':' + email_hash + ':' + salt)
```
- `salt`는 환경변수 `NICKNAME_SALT`로 외부 보관 (코드·DB에 박지 않음)
- `email_hash`는 `profiles.email_hash`와 동일 계산식 사용
- 결과: 32 byte (hex 64자)

### 2.3 접미사 추출
1차: `seed.slice(0, 4)` → 후보 닉네임 `숙의야_${hex4}`
중복 시: `seed.slice(4, 8)` → 재시도
계속 충돌: `seed.slice(N*4, N*4+4)` for N=2,3,4,... (최대 16회)
16회 모두 충돌: `숙의야_${hex4}${random2}` (총 10자) 로 확장 → UNIQUE 통과까지 반복

### 2.4 의사코드
```sql
CREATE OR REPLACE FUNCTION generate_default_nickname(p_seed text)
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
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE nickname = v_nickname) THEN
      RETURN v_nickname;
    END IF;
    v_offset := v_offset + 1;
  END LOOP;

  -- 16회 모두 충돌 시: 4자 + 랜덤 2자 확장
  LOOP
    v_nickname := '숙의야_' || substr(p_seed, 1, 4) ||
                  lpad(to_hex((random() * 255)::int), 2, '0');
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE nickname = v_nickname) THEN
      RETURN v_nickname;
    END IF;
  END LOOP;
END;
$$;
```

### 2.5 트리거 (`auth.users` AFTER INSERT)
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider auth_provider;
  v_provider_id text;
  v_email text;
  v_email_hash text;
  v_seed text;
  v_nickname text;
BEGIN
  v_provider := (NEW.raw_app_meta_data->>'provider')::auth_provider;
  v_provider_id := NEW.raw_user_meta_data->>'provider_id';
  v_email := NEW.email;
  v_email_hash := encode(digest(lower(v_email), 'sha256'), 'hex');
  v_seed := encode(
    digest(
      v_provider::text || ':' || v_provider_id || ':' || v_email_hash || ':' ||
        current_setting('app.nickname_salt'),
      'sha256'
    ),
    'hex'
  );
  v_nickname := generate_default_nickname(v_seed);

  INSERT INTO profiles (id, provider, provider_id, email, email_hash, nickname)
  VALUES (NEW.id, v_provider, v_provider_id, v_email, v_email_hash, v_nickname);

  -- 알림 기본 설정도 함께
  INSERT INTO notification_preferences (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**전제:**
- `pgcrypto` extension 활성화 (Supabase 기본 활성화돼 있음)
- `app.nickname_salt` 설정값을 마이그레이션 시 Supabase 환경에 주입

---

## 3. 사용자 변경 규칙

### 3.1 변경 가능 조건 (모두 만족 시)
1. `profiles.nickname_changed = false` — 아직 1회도 변경 안 함
2. `profiles.nickname_changed_at IS NULL` 또는 `nickname_changed_at + interval '7 days' <= now()` — 가입 후 7일 또는 마지막 변경 후 7일 경과 (D-Q1)
3. 새 닉네임이 §1.2 형식 통과
4. 새 닉네임이 §5 금지 사전 미매칭
5. 새 닉네임이 `profiles.nickname` UNIQUE 통과
6. 본인 인증 (`auth.uid() = profiles.id`)

### 3.2 변경 후 상태
- `nickname_changed = true` (이후 영구 변경 불가)
- `nickname_changed_at = now()`
- `updated_at = now()` (트리거 자동)

### 3.3 트리거 (`profiles` BEFORE UPDATE)
```sql
CREATE OR REPLACE FUNCTION nickname_cycle_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 닉네임이 바뀌지 않으면 통과
  IF NEW.nickname = OLD.nickname THEN
    RETURN NEW;
  END IF;

  -- 이미 1회 변경 후 영구 고정
  IF OLD.nickname_changed = true THEN
    RAISE EXCEPTION '닉네임은 1회만 변경 가능합니다';
  END IF;

  -- 7일 락 (D-Q1: 마지막 변경 후 7일)
  IF OLD.nickname_changed_at IS NOT NULL
     AND OLD.nickname_changed_at + interval '7 days' > now() THEN
    RAISE EXCEPTION '닉네임 변경 후 7일이 지나지 않았습니다';
  END IF;

  -- 형식 검증
  IF NEW.nickname !~ '^[가-힣a-zA-Z0-9_]{2,20}$' THEN
    RAISE EXCEPTION '닉네임 형식이 올바르지 않습니다';
  END IF;
  IF NEW.nickname LIKE '숙의야_%' THEN
    RAISE EXCEPTION '"숙의야_"로 시작하는 닉네임은 사용할 수 없습니다';
  END IF;

  -- 금지 단어 매칭
  IF EXISTS (
    SELECT 1 FROM moderation_rules
    WHERE active = true
      AND rule_type IN ('profanity', 'hate')
      AND NEW.nickname ~* pattern
  ) THEN
    RAISE EXCEPTION '사용할 수 없는 단어가 포함되어 있습니다';
  END IF;

  NEW.nickname_changed := true;
  NEW.nickname_changed_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nickname_change_lock
  BEFORE UPDATE OF nickname ON profiles
  FOR EACH ROW EXECUTE FUNCTION nickname_cycle_lock();
```

---

## 4. UI 흐름 (참조)

### 4.1 가입 직후
- 자동 생성된 닉네임 표시 (`숙의야_a3f9`)
- 헤더에 "닉네임 변경 가능 (1회)" 배지 노출
- 마이페이지 → "닉네임 변경" 메뉴 활성화

### 4.2 변경 시도
- 입력 칸: 실시간 형식 검증 (2~20자, 허용 문자, 접두사 차단)
- 중복 체크: 0.5초 debounce 후 `GET /api/profile/nickname-available?value=...`
- "변경" 클릭 시:
  - 서버 액션 `updateNickname(newNickname)` → Supabase UPDATE
  - 트리거 통과 → 성공 토스트 + 헤더 배지 제거
  - 트리거 거부 → 에러 메시지 매핑 표시

### 4.3 변경 불가 시 노출
- 이미 변경함: "닉네임은 1회만 변경 가능합니다 (마지막 변경: YYYY-MM-DD)"
- 7일 락 중: "다음 변경 가능 시각: YYYY-MM-DD HH:mm"

---

## 5. 금지 사전 (moderation_rules 활용)

- 자동 생성된 `숙의야_xxxx`는 `xxxx`가 hex 4자라 모욕적 단어 매칭 가능성 거의 0 (예: `dead`, `cafe` 등은 의도하지 않은 매칭 가능 — 화이트리스트 차원에선 무시)
- **사용자 변경 시에만 `moderation_rules` 검사 적용** (§3.3 트리거 안)
- `rule_type IN ('profanity', 'hate')`만 닉네임에 적용. `ad`, `personal_info`는 본문 콘텐츠 전용.

---

## 6. 보안·운영 메모

1. **`NICKNAME_SALT` 관리**
   - Supabase Postgres GUC (`app.nickname_salt`)에 ALTER DATABASE로 설정
   - 노출 시 닉네임 추측 가능 → 비밀 유지
   - 변경 시 기존 사용자 닉네임은 그대로 (시드는 가입 시점에만 사용)

2. **익명성 보장**
   - 닉네임으로부터 OAuth provider/email/실명 역추적 불가능 (sha256 + salt)
   - 동일 사용자가 탈퇴 후 같은 카카오 계정으로 재가입 시:
     - `profiles` row가 cascade로 사라졌다 새로 생성 → **같은 닉네임 생성 가능성 매우 낮음** (시드 동일하지만 sha256 충돌 외엔 같은 sub 재사용 어려움. 만약 사용자가 의도적으로 같은 OAuth로 재가입하면 같은 닉네임 받을 수 있음)
   - 우려 시 시드에 `auth.users.id`(uuid) 추가 → 매번 다른 닉네임. 단 D2 어뷰징 방지(email_hash UNIQUE)로 재가입 자체가 차단되므로 v0은 단순화

3. **충돌률 모니터링**
   - `generate_default_nickname` 함수가 `v_offset > 4`로 진입한 횟수를 카운터로 노출 (서비스 운영 후 모니터링용)
   - 사용자 수 1만 명 도달 시 4자 hex 충돌률 ≈ 0.76% (생일 문제). 5만 명에서 ≈ 16%, 10만 명에서 ≈ 53%. → **5만 명 도달 전에 5자로 확장 검토**

---

## 7. 테스트 케이스 (마이그레이션 작성 후 검증)

| # | 케이스 | 입력 | 기대 결과 |
|---|--------|------|-----------|
| 1 | 신규 가입 | 카카오 OAuth 신규 사용자 | `profiles.nickname = '숙의야_xxxx'` 형태로 row 자동 생성 |
| 2 | 닉네임 충돌 | 첫 4자 hex가 이미 존재 | 다음 4자 hex 시도 → 성공 |
| 3 | 가입 직후 즉시 변경 | `nickname_changed=false`, `nickname_changed_at=NULL` | 변경 허용 |
| 4 | 변경 후 다시 변경 시도 | `nickname_changed=true` | "1회만 변경 가능" 에러 |
| 5 | 7일 락 중 변경 | `nickname_changed_at = now() - 3 days` (가정상 false, 테스트 위해 두 변경 허용 모드) | "7일 락" 에러 |
| 6 | 형식 위반 | `"홍 길동"` (공백) | "형식 올바르지 않음" 에러 |
| 7 | 접두사 위반 | `"숙의야_홍길동"` | "숙의야_로 시작 불가" 에러 |
| 8 | 욕설 매칭 | `moderation_rules`에 등록된 단어 포함 | "사용 불가 단어" 에러 |
| 9 | 중복 닉네임 | 이미 존재하는 닉네임 | UNIQUE violation → 에러 |
| 10 | 본인 외 변경 시도 | RLS로 차단 | "권한 없음" 에러 |

---

## 8. 다음 단계
- `supabase/migrations/002_profiles.sql`에 본 규칙의 함수·트리거 포함
- 마이그레이션 작성 시 본 문서를 SQL 주석으로 참조
- 변경 UI는 Phase 2(인증·온보딩) 작업에서 구현

— nickname-rule v0.1 끝 —
