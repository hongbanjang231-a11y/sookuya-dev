'use client';

import { useMemo, useState, useTransition } from 'react';

import { createTopic } from '@/app/actions/topics';
import { computeCycle, formatKst, isMonday } from '@/lib/cycle';

const CATEGORIES = [
  { value: 'society', label: '사회' },
  { value: 'tech', label: '기술' },
  { value: 'lifestyle', label: '생활' },
  { value: 'culture', label: '문화' },
  { value: 'economy', label: '경제' },
  { value: 'education', label: '교육' },
  { value: 'environment', label: '환경' },
];

export function TopicForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [monday, setMonday] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'candidate' | 'active'>('candidate');

  const preview = useMemo(() => {
    if (!monday || !isMonday(monday)) return null;
    try {
      return computeCycle(monday);
    } catch {
      return null;
    }
  }, [monday]);

  const mondayInvalid = monday.length > 0 && !isMonday(monday);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('monday_ymd', monday);

    startTransition(async () => {
      const result = await createTopic(formData);
      if (result?.error) {
        setError(result.error);
      }
      // 성공 시 서버 액션이 /admin/topics로 redirect
    });
  }

  return (
    <form
      action={handleSubmit}
      className="border-line bg-bg-elevated max-w-[720px] space-y-6 rounded-[16px] border p-8 shadow-sm"
    >
      {/* 제목 */}
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-medium">
          제목 <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: AI 시대의 일자리 변화, 어떻게 대응할 것인가"
          required
          minLength={3}
          maxLength={100}
          className="border-line-solid bg-bg focus:border-primary text-label-strong placeholder:text-label-assistive w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none transition-colors"
        />
        <p className="text-label-alternative mt-1 text-[12px]">
          {title.length} / 100
        </p>
      </div>

      {/* 설명 */}
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-medium">
          설명 <span className="text-danger">*</span>
        </label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="주제 배경과 토론 포인트를 적어주세요"
          required
          minLength={10}
          rows={4}
          className="border-line-solid bg-bg focus:border-primary text-label-strong placeholder:text-label-assistive w-full resize-y rounded-[10px] border px-3 py-2.5 text-[14px] outline-none transition-colors"
        />
      </div>

      {/* 카테고리 */}
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-medium">
          카테고리 <span className="text-danger">*</span>
        </label>
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="border-line-solid bg-bg focus:border-primary text-label-strong w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none transition-colors"
        >
          <option value="">선택...</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* 사이클 시작 (월요일) */}
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-medium">
          사이클 시작 (월요일만) <span className="text-danger">*</span>
        </label>
        <input
          type="date"
          value={monday}
          onChange={(e) => setMonday(e.target.value)}
          required
          className={`border-line-solid bg-bg focus:border-primary text-label-strong w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none transition-colors ${mondayInvalid ? 'border-danger focus:border-danger' : ''}`}
        />
        {mondayInvalid && (
          <p className="text-danger mt-1 text-[12px]">월요일만 선택 가능합니다</p>
        )}
      </div>

      {/* 자동 계산 미리보기 */}
      {preview && (
        <div className="bg-bg-alt border-line-subtle space-y-1.5 rounded-[10px] border p-4">
          <p className="text-label-alternative mb-2 text-[12px] font-medium">
            자동 계산된 사이클 윈도우 (KST)
          </p>
          <CycleRow label="의견 작성" range={[preview.opinion_window_starts_at, preview.opinion_window_ends_at]} />
          <CycleRow label="의견 투표" range={[preview.vote_window_starts_at, preview.vote_window_ends_at]} />
          <CycleRow label="댓글 마감" single={preview.comment_window_ends_at} />
          <CycleRow label="사이클 종료" single={preview.cycle_ends_at} />
        </div>
      )}

      {/* 초기 상태 */}
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-medium">
          초기 상태 <span className="text-danger">*</span>
        </label>
        <div className="flex gap-3">
          <StatusOption
            value="candidate"
            label="후보 (candidate)"
            description="다음 주 사용자 투표 풀에 들어감"
            current={status}
            onChange={setStatus}
          />
          <StatusOption
            value="active"
            label="진행중 (active)"
            description="즉시 사이클 시작 (시드용)"
            current={status}
            onChange={setStatus}
          />
        </div>
        <input type="hidden" name="status" value={status} />
      </div>

      {error && (
        <div className="bg-danger/15 text-danger rounded-[10px] px-4 py-3 text-[13px]">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary inline-flex items-center justify-center rounded-[10px] px-6 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {isPending ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

function CycleRow({
  label,
  range,
  single,
}: {
  label: string;
  range?: [string, string];
  single?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="text-label-alternative w-20 shrink-0">{label}</span>
      <span className="text-label-strong font-medium tabular-nums">
        {range
          ? `${formatKst(range[0])} ~ ${formatKst(range[1])}`
          : single
            ? formatKst(single)
            : ''}
      </span>
    </div>
  );
}

function StatusOption({
  value,
  label,
  description,
  current,
  onChange,
}: {
  value: 'candidate' | 'active';
  label: string;
  description: string;
  current: string;
  onChange: (v: 'candidate' | 'active') => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex-1 rounded-[10px] border p-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-line-solid bg-bg hover:border-line'
      }`}
    >
      <p className="text-label-strong text-[14px] font-bold">{label}</p>
      <p className="text-label-alternative mt-0.5 text-[12px]">{description}</p>
    </button>
  );
}
