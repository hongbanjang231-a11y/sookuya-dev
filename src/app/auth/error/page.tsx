import Link from 'next/link';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="bg-bg-alt min-h-screen">
      <section className="mx-auto max-w-[480px] px-5 py-24">
        <div className="border-line bg-bg-elevated rounded-[16px] border p-8 shadow-md">
          <div className="bg-danger/15 text-danger mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium">
            로그인 실패
          </div>
          <h1 className="text-label-strong text-[22px] font-bold tracking-tight">
            로그인을 완료하지 못했습니다
          </h1>
          <p className="text-label-neutral mt-3 text-[14px] leading-relaxed">
            {reason
              ? `사유: ${decodeURIComponent(reason)}`
              : '알 수 없는 오류가 발생했습니다.'}
          </p>
          <Link
            href="/"
            className="bg-primary mt-6 inline-flex items-center justify-center rounded-[10px] px-5 py-2.5 text-[15px] font-bold text-white"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
