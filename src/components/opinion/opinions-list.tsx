import type { VoteValue } from '@/app/actions/votes';

import { VoteButtons } from './vote-buttons';

export interface OpinionListItem {
  id: string;
  body: string;
  agree_count: number;
  disagree_count: number;
  unsure_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_nickname: string;
}

export interface OpinionsListProps {
  opinions: OpinionListItem[];
  myVotes: Record<string, VoteValue>;
  canVote: boolean;
  cantVoteReason?: string;
}

export function OpinionsList({
  opinions,
  myVotes,
  canVote,
  cantVoteReason,
}: OpinionsListProps) {
  if (opinions.length === 0) {
    return (
      <div className="border-line bg-bg-elevated rounded-[16px] border p-6 text-center shadow-sm">
        <p className="text-label-neutral text-[14px]">
          아직 다른 사람의 의견이 없어요. 첫 토론자가 되어보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-label-strong text-[15px] font-bold">
        다른 사람들의 의견 · {opinions.length}
      </h2>
      <ul className="flex flex-col gap-3">
        {opinions.map((op) => {
          const wasEdited =
            new Date(op.updated_at).getTime() -
              new Date(op.created_at).getTime() >
            1000;
          return (
            <li
              key={op.id}
              className="border-line bg-bg-elevated rounded-[14px] border p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label-neutral text-[12px] font-medium">
                  {op.author_nickname}
                </span>
                {wasEdited && (
                  <span className="text-label-alternative text-[11px]">
                    수정됨
                  </span>
                )}
              </div>
              <p className="text-label-strong text-[14px] leading-relaxed whitespace-pre-line">
                {op.body}
              </p>
              <div className="mt-4">
                <VoteButtons
                  opinionId={op.id}
                  counts={{
                    agree: op.agree_count,
                    disagree: op.disagree_count,
                    unsure: op.unsure_count,
                  }}
                  myVote={myVotes[op.id] ?? null}
                  disabled={!canVote}
                  disabledReason={cantVoteReason}
                />
              </div>
              {op.comment_count > 0 && (
                <p className="text-label-alternative mt-3 text-[12px]">
                  댓글 {op.comment_count}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
