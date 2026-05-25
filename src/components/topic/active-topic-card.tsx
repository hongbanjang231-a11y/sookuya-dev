import { formatKst, formatTimeLeft, getCyclePhase } from '@/lib/cycle';

const CATEGORY_LABELS: Record<string, string> = {
  society: '사회',
  tech: '기술',
  lifestyle: '생활',
  culture: '문화',
  economy: '경제',
  education: '교육',
  environment: '환경',
};

const PHASE_STYLES: Record<string, string> = {
  pre_opinion: 'bg-fill text-label-neutral',
  opinion: 'bg-primary/15 text-primary',
  between_opinion_vote: 'bg-fill text-label-neutral',
  vote: 'bg-warning/15 text-warning',
  between_vote_end: 'bg-fill text-label-neutral',
  ended: 'bg-fill text-label-alternative',
};

export interface ActiveTopic {
  id: string;
  title: string;
  description: string;
  category: string;
  cycle_starts_at: string;
  cycle_ends_at: string;
  opinion_window_starts_at: string;
  opinion_window_ends_at: string;
  vote_window_starts_at: string;
  vote_window_ends_at: string;
  comment_window_ends_at: string;
}

export function ActiveTopicCard({ topic }: { topic: ActiveTopic }) {
  const phaseInfo = getCyclePhase(topic);
  const phaseClass = PHASE_STYLES[phaseInfo.phase] ?? 'bg-fill text-label-neutral';

  return (
    <article className="border-line bg-bg-elevated rounded-[16px] border p-8 shadow-md">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${phaseClass}`}
          >
            <span className="bg-current h-1.5 w-1.5 rounded-full opacity-70" />
            {phaseInfo.label}
          </span>
          <span className="bg-fill text-label-alternative rounded-full px-3 py-1 text-[12px] font-medium">
            {CATEGORY_LABELS[topic.category] ?? topic.category}
          </span>
        </div>
        {phaseInfo.nextDeadline && phaseInfo.nextLabel && (
          <div className="text-right">
            <p className="text-label-alternative text-[11px]">
              {phaseInfo.nextLabel}
            </p>
            <p className="text-label-strong text-[14px] font-bold tabular-nums">
              {formatTimeLeft(phaseInfo.nextDeadline)}
            </p>
          </div>
        )}
      </header>

      <h1 className="text-label-strong mt-5 text-[26px] leading-tight font-bold tracking-tight">
        {topic.title}
      </h1>
      <p className="text-label-neutral mt-3 text-[15px] leading-relaxed whitespace-pre-line">
        {topic.description}
      </p>

      <CycleTimeline topic={topic} currentPhase={phaseInfo.phase} />
    </article>
  );
}

function CycleTimeline({
  topic,
  currentPhase,
}: {
  topic: ActiveTopic;
  currentPhase: string;
}) {
  const steps = [
    {
      key: 'opinion',
      label: '의견 작성',
      from: topic.opinion_window_starts_at,
      to: topic.opinion_window_ends_at,
      active: currentPhase === 'opinion',
      done: ['between_opinion_vote', 'vote', 'between_vote_end', 'ended'].includes(
        currentPhase,
      ),
    },
    {
      key: 'vote',
      label: '의견 투표',
      from: topic.vote_window_starts_at,
      to: topic.vote_window_ends_at,
      active: currentPhase === 'vote',
      done: ['between_vote_end', 'ended'].includes(currentPhase),
    },
    {
      key: 'conclusion',
      label: '결론 발표',
      from: topic.comment_window_ends_at,
      to: topic.comment_window_ends_at,
      active: currentPhase === 'between_vote_end',
      done: currentPhase === 'ended',
    },
  ];

  return (
    <ol className="border-line-subtle mt-6 grid gap-2 border-t pt-5 sm:grid-cols-3">
      {steps.map((s) => (
        <li
          key={s.key}
          className={`rounded-[10px] p-3 ${
            s.active
              ? 'bg-primary/5 border-primary border'
              : s.done
                ? 'bg-fill'
                : 'bg-bg-alt'
          }`}
        >
          <p
            className={`text-[11px] font-medium ${
              s.active
                ? 'text-primary'
                : s.done
                  ? 'text-label-alternative'
                  : 'text-label-alternative'
            }`}
          >
            {s.label}
          </p>
          <p className="text-label-strong mt-1 text-[12px] tabular-nums">
            {formatKst(s.from)}
            {s.from !== s.to && (
              <>
                <br />~ {formatKst(s.to)}
              </>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
