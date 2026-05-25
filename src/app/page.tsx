import Link from 'next/link';

import { LoginButtons } from '@/components/auth/login-buttons';
import { UserCard } from '@/components/auth/user-card';
import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <main className="bg-bg-alt min-h-screen">
      <header className="border-line-subtle border-b">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <h1 className="text-[20px] font-bold tracking-tight">숙의야</h1>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin/topics"
                className="bg-fill text-label-neutral hover:text-label-strong rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
              >
                관리자 페이지
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[640px] px-5 py-16">
        <div className="border-line bg-bg-elevated rounded-[16px] border p-8 shadow-md">
          <div className="bg-fill text-label-neutral mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px]">
            <span className="bg-success h-1.5 w-1.5 rounded-full" />
            Phase 0 — 셋업 완료
          </div>

          <h2 className="text-label-strong text-[28px] leading-tight font-bold tracking-tight">
            주 1 주제, 7일 사이클.
            <br />
            깊이 있는 토론.
          </h2>
          <p className="text-label-neutral mt-3 text-[15px] leading-relaxed">
            매주 월요일 한 주제가 열립니다. 의견을 쓰고, 다른 의견에 동의·반대로
            투표하고, 일요일 저녁에 결론 리포트를 받아보세요.
          </p>

          <div className="mt-8 flex flex-col items-center">
            {user ? <UserCard user={user} /> : <LoginButtons />}
          </div>
        </div>

        {/* WDS 토큰 검증 패널 */}
        <div className="border-line mt-10 rounded-[12px] border border-dashed p-5">
          <p className="text-label-alternative mb-4 text-[12px] font-medium">
            WDS 토큰 검증 (Phase 0 종료 후 제거)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="bg-primary rounded-[12px] px-7 py-3 text-[16px] font-bold text-white">
              Large
            </button>
            <button className="bg-primary rounded-[10px] px-5 py-2.5 text-[15px] font-bold text-white">
              Medium
            </button>
            <button className="bg-primary rounded-[8px] px-3.5 py-1.5 text-[13px] font-bold text-white">
              Small
            </button>
            <button className="border-line-solid text-label-normal rounded-[10px] border px-5 py-2.5 text-[15px] font-medium">
              Outlined
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bg-success/15 text-success rounded-full px-3 py-1 text-[12px] font-medium">
              positive
            </span>
            <span className="bg-warning/15 text-warning rounded-full px-3 py-1 text-[12px] font-medium">
              cautionary
            </span>
            <span className="bg-danger/15 text-danger rounded-full px-3 py-1 text-[12px] font-medium">
              negative
            </span>
          </div>
          <p className="text-label-alternative mt-4 text-[13px]">
            테마 토글이 동작하면 위 색이 모두 다크모드로 전환됩니다.
          </p>
        </div>
      </section>
    </main>
  );
}
