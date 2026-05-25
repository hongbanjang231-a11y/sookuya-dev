'use client';

import { useState } from 'react';

import { OpinionForm } from './opinion-form';

export interface OpinionDisplayProps {
  opinion: {
    id: string;
    body: string;
    agree_count: number;
    disagree_count: number;
    unsure_count: number;
    comment_count: number;
    created_at: string;
    updated_at: string;
  };
  topicId: string;
  canEdit: boolean;
}

export function OpinionDisplay({
  opinion,
  topicId,
  canEdit,
}: OpinionDisplayProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <OpinionForm
        topicId={topicId}
        existing={{ id: opinion.id, body: opinion.body }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const wasEdited =
    new Date(opinion.updated_at).getTime() -
      new Date(opinion.created_at).getTime() >
    1000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-label-strong text-[14px] font-bold">내 의견</p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-primary text-[12px] font-medium hover:underline"
          >
            수정
          </button>
        )}
      </div>

      <div className="border-line-solid bg-bg-alt rounded-[10px] border p-4">
        <p className="text-label-strong text-[14px] leading-relaxed whitespace-pre-line">
          {opinion.body}
        </p>
        <p className="text-label-alternative mt-3 text-[11px]">
          {[...opinion.body].length}자
          {wasEdited && ' · 수정됨'}
        </p>
      </div>

      <div className="text-label-alternative flex gap-4 text-[12px]">
        <span>동의 {opinion.agree_count}</span>
        <span>반대 {opinion.disagree_count}</span>
        <span>잘 모름 {opinion.unsure_count}</span>
        <span>댓글 {opinion.comment_count}</span>
      </div>
    </div>
  );
}
