'use client';

import { useState, useTransition } from 'react';

import { createOpinion, updateOpinion } from '@/app/actions/opinions';

const MIN = 100;
const MAX = 300;

export interface OpinionFormProps {
  topicId: string;
  existing?: {
    id: string;
    body: string;
  };
  onCancel?: () => void;
}

export function OpinionForm({ topicId, existing, onCancel }: OpinionFormProps) {
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const charCount = [...body].length;
  const tooShort = charCount < MIN;
  const tooLong = charCount > MAX;
  const invalid = tooShort || tooLong;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('body', body);
    if (existing) {
      formData.set('opinion_id', existing.id);
    } else {
      formData.set('topic_id', topicId);
    }

    startTransition(async () => {
      const action = existing ? updateOpinion : createOpinion;
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
      } else {
        // 성공 시 revalidatePath('/')가 페이지 갱신 → 폼이 OpinionDisplay로 대체됨
        onCancel?.();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-label-strong mb-2 block text-[14px] font-bold">
          {existing ? '의견 수정' : '의견 작성'}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="이 주제에 대한 의견을 자유롭게 작성해주세요 (100~300자)"
          rows={6}
          required
          className="border-line-solid bg-bg focus:border-primary text-label-strong placeholder:text-label-assistive w-full resize-y rounded-[10px] border px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-colors"
        />
        <div className="mt-1.5 flex items-center justify-between text-[12px]">
          <span
            className={
              tooShort
                ? 'text-label-alternative'
                : tooLong
                  ? 'text-danger'
                  : 'text-success'
            }
          >
            {charCount} / {MAX}자 (최소 {MIN}자)
          </span>
          {tooLong && (
            <span className="text-danger">
              {MAX}자를 초과했습니다 ({charCount - MAX}자)
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger/15 text-danger rounded-[10px] px-3 py-2 text-[13px]">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {existing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border-line-solid text-label-neutral hover:bg-fill rounded-[10px] border px-4 py-2 text-[13px] font-medium transition-colors"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || invalid}
          className="bg-primary inline-flex items-center justify-center rounded-[10px] px-5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {isPending ? '처리 중...' : existing ? '수정 저장' : '의견 등록'}
        </button>
      </div>
    </form>
  );
}
