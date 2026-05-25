import { signOut } from '@/app/actions/auth';
import type { User } from '@supabase/supabase-js';

export function UserCard({ user }: { user: User }) {
  const nickname =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.nickname as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    user.email?.split('@')[0] ??
    '닉네임 없음';

  const provider = user.app_metadata.provider ?? 'unknown';

  return (
    <div className="flex w-full max-w-[320px] flex-col gap-4">
      <div className="border-line bg-bg rounded-[12px] border p-4">
        <p className="text-label-alternative text-[12px]">로그인됨</p>
        <p className="text-label-strong mt-1 text-[18px] font-bold">
          {nickname}
        </p>
        <p className="text-label-neutral mt-1 text-[12px]">
          {user.email ?? '(이메일 없음)'}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[11px] font-medium">
            {provider}
          </span>
          <span className="text-label-alternative text-[11px]">
            {new Date(user.created_at).toLocaleDateString('ko-KR')} 가입
          </span>
        </div>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="border-line-solid text-label-normal hover:bg-fill h-11 w-full rounded-[10px] border text-[14px] font-medium transition-colors"
        >
          로그아웃
        </button>
      </form>

      <details className="border-line text-label-alternative rounded-[10px] border p-3 text-[11px]">
        <summary className="cursor-pointer">
          (개발용) user_metadata 펼치기
        </summary>
        <pre className="mt-2 overflow-x-auto break-all whitespace-pre-wrap">
          {JSON.stringify(user.user_metadata, null, 2)}
        </pre>
      </details>
    </div>
  );
}
