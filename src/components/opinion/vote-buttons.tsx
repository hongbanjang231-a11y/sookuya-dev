'use client';

import { useState, useTransition } from 'react';

import { castVote, removeVote, type VoteValue } from '@/app/actions/votes';

export interface VoteCounts {
  agree: number;
  disagree: number;
  unsure: number;
}

export interface VoteButtonsProps {
  opinionId: string;
  counts: VoteCounts;
  myVote: VoteValue | null;
  disabled?: boolean; // 비로그인·자기 의견·사이클 종료 등
  disabledReason?: string;
}

const OPTIONS: { value: VoteValue; label: string }[] = [
  { value: 'agree', label: '동의' },
  { value: 'disagree', label: '반대' },
  { value: 'unsure', label: '잘 모름' },
];

export function VoteButtons({
  opinionId,
  counts,
  myVote,
  disabled = false,
  disabledReason,
}: VoteButtonsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick(value: VoteValue) {
    if (disabled || isPending) return;
    setError(null);

    startTransition(async () => {
      const result =
        value === myVote
          ? await removeVote(opinionId)
          : await castVote(opinionId, value);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {OPTIONS.map((opt) => {
          const selected = myVote === opt.value;
          const count = counts[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleClick(opt.value)}
              disabled={disabled || isPending}
              aria-pressed={selected}
              title={disabled ? disabledReason : undefined}
              className={
                selected
                  ? 'border-primary bg-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-bold text-white transition-colors disabled:opacity-50'
                  : 'border-line-solid text-label-strong hover:bg-fill inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50'
              }
            >
              <span>{opt.label}</span>
              <span className={selected ? 'opacity-90' : 'text-label-alternative'}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <div className="bg-danger/15 text-danger rounded-[8px] px-3 py-1.5 text-[12px]">
          {error}
        </div>
      )}
      {disabled && disabledReason && !error && (
        <p className="text-label-alternative text-[11px]">{disabledReason}</p>
      )}
    </div>
  );
}
