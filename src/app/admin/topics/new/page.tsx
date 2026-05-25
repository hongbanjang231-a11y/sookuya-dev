import Link from 'next/link';

import { TopicForm } from '@/components/admin/topic-form';

export default function NewTopicPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/topics"
          className="text-label-neutral hover:text-label-strong text-[13px]"
        >
          ← 토픽 목록
        </Link>
        <h1 className="text-label-strong mt-2 text-[24px] font-bold tracking-tight">
          새 토픽 등록
        </h1>
        <p className="text-label-neutral mt-1 text-[14px]">
          월요일 날짜만 선택하면 7일 사이클의 모든 윈도우가 자동 설정됩니다.
        </p>
      </div>

      <TopicForm />
    </div>
  );
}
