import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { formatKst } from '@/lib/cycle';

const CATEGORY_LABELS: Record<string, string> = {
  society: '사회',
  tech: '기술',
  lifestyle: '생활',
  culture: '문화',
  economy: '경제',
  education: '교육',
  environment: '환경',
};

const STATUS_LABELS: Record<string, { label: string; klass: string }> = {
  candidate: { label: '후보', klass: 'bg-fill text-label-neutral' },
  voting_next: { label: '투표중', klass: 'bg-warning/15 text-warning' },
  active: { label: '진행중', klass: 'bg-success/15 text-success' },
  archived: { label: '마감', klass: 'bg-fill text-label-alternative' },
};

export default async function TopicsListPage() {
  const supabase = await createClient();
  const { data: topics, error } = await supabase
    .from('topics')
    .select(
      'id, title, category, status, cycle_starts_at, cycle_ends_at, created_at',
    )
    .order('cycle_starts_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-label-strong text-[24px] font-bold tracking-tight">
            토픽 관리
          </h1>
          <p className="text-label-neutral mt-1 text-[14px]">
            주제 후보 등록, 사이클 일정 관리
          </p>
        </div>
        <Link
          href="/admin/topics/new"
          className="bg-primary inline-flex items-center justify-center rounded-[10px] px-5 py-2.5 text-[14px] font-bold text-white"
        >
          + 새 토픽 등록
        </Link>
      </div>

      {error && (
        <div className="bg-danger/15 text-danger mb-4 rounded-[10px] px-4 py-3 text-[14px]">
          토픽 조회 실패: {error.message}
        </div>
      )}

      <div className="border-line bg-bg-elevated overflow-hidden rounded-[12px] border">
        <table className="w-full text-left text-[14px]">
          <thead className="border-line-subtle bg-bg-alt border-b">
            <tr>
              <th className="text-label-neutral px-4 py-3 font-medium">
                제목
              </th>
              <th className="text-label-neutral px-4 py-3 font-medium">
                카테고리
              </th>
              <th className="text-label-neutral px-4 py-3 font-medium">
                상태
              </th>
              <th className="text-label-neutral px-4 py-3 font-medium">
                사이클 시작
              </th>
              <th className="text-label-neutral px-4 py-3 font-medium">
                사이클 종료
              </th>
            </tr>
          </thead>
          <tbody>
            {!topics || topics.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-label-alternative px-4 py-12 text-center"
                >
                  아직 등록된 토픽이 없습니다.{' '}
                  <Link
                    href="/admin/topics/new"
                    className="text-primary hover:underline"
                  >
                    첫 토픽 등록하기 →
                  </Link>
                </td>
              </tr>
            ) : (
              topics.map((t) => {
                const status = STATUS_LABELS[t.status] ?? {
                  label: t.status,
                  klass: 'bg-fill text-label-neutral',
                };
                return (
                  <tr
                    key={t.id}
                    className="border-line-subtle border-b last:border-b-0"
                  >
                    <td className="text-label-strong px-4 py-3 font-medium">
                      {t.title}
                    </td>
                    <td className="text-label-neutral px-4 py-3">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${status.klass}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="text-label-neutral px-4 py-3 text-[13px]">
                      {formatKst(t.cycle_starts_at)}
                    </td>
                    <td className="text-label-neutral px-4 py-3 text-[13px]">
                      {formatKst(t.cycle_ends_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
