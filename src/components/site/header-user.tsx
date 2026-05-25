import Link from 'next/link';

import { signOut } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/theme-toggle';

export interface HeaderUserData {
  nickname: string;
  isAdmin: boolean;
}

export function HeaderUser({ user }: { user: HeaderUserData | null }) {
  return (
    <div className="flex items-center gap-3">
      {user?.isAdmin && (
        <Link
          href="/admin/topics"
          className="bg-fill text-label-neutral hover:text-label-strong rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
        >
          관리자
        </Link>
      )}
      {user ? (
        <>
          <span className="text-label-alternative hidden text-[13px] sm:inline">
            {user.nickname}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-label-neutral hover:text-label-strong text-[13px] font-medium transition-colors"
            >
              로그아웃
            </button>
          </form>
        </>
      ) : null}
      <ThemeToggle />
    </div>
  );
}
