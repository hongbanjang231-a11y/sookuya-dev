import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';
import { requireAdmin } from '@/lib/supabase/admin-check';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="bg-bg-alt min-h-screen">
      <header className="border-line-subtle border-b">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-label-strong text-[20px] font-bold tracking-tight"
            >
              숙의야
            </Link>
            <span className="bg-fill text-label-neutral rounded-full px-3 py-1 text-[12px] font-medium">
              관리자
            </span>
            <nav className="flex items-center gap-4">
              <Link
                href="/admin/topics"
                className="text-label-neutral hover:text-label-strong text-[14px] font-medium transition-colors"
              >
                토픽 관리
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-label-alternative text-[13px]">
              {admin.nickname}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 py-8">{children}</main>
    </div>
  );
}
