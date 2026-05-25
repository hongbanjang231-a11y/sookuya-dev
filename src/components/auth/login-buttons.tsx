'use client';

import { createClient } from '@/lib/supabase/client';

export function LoginButtons() {
  const handleKakao = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('카카오 로그인 실패:', error.message);
      alert(
        `카카오 로그인 실패: ${error.message}\n\n.env.local의 Supabase 키와 카카오 OAuth 설정을 확인해주세요.`,
      );
    }
  };

  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <button
        type="button"
        onClick={handleKakao}
        className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#FEE500] text-[15px] font-medium text-[#000000D9] transition-opacity hover:opacity-90"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 3C5.58 3 2 5.84 2 9.34c0 2.27 1.5 4.25 3.74 5.36-.16.6-.6 2.25-.69 2.6-.1.43.16.42.34.31.14-.1 2.22-1.51 3.12-2.12.49.07.99.11 1.49.11 4.42 0 8-2.84 8-6.34S14.42 3 10 3z"
            fill="currentColor"
          />
        </svg>
        카카오로 시작하기
      </button>

      <button
        type="button"
        disabled
        aria-disabled
        className="bg-fill text-label-assistive flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-[10px] text-[15px] font-medium"
      >
        네이버로 시작하기
        <span className="text-label-alternative text-[12px]">(준비중)</span>
      </button>

      <p className="text-label-alternative text-center text-[12px]">
        가입 시 약관·개인정보처리방침에 동의한 것으로 간주됩니다.
      </p>
    </div>
  );
}
