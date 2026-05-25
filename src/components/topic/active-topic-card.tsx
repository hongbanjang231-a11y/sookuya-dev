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
  pre: 'bg-fill text-label-neutral',
  active: 'bg-primary/15 text-primary',
  ended: 'bg-fill text-label-alternative',
};

export interface ActiveTopic {
  id: string;
  title: string;
  description: string;
  category: string;
  cycle_starts_at: string;
  cycle_ends_at: string;
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

      <CycleTimeline topic={topic} phase={phaseInfo.phase} />
    </article>
  );
}

function CycleTimeline({
  topic,
  phase,
}: {
  topic: ActiveTopic;
  phase: string;
}) {
  return (
    <ol className="border-line-subtle mt-6 grid gap-2 border-t pt-5 sm:grid-cols-2">
      <li
        className={`rounded-[10px] p-3 ${
          phase === 'active' || phase === 'ended'
            ? 'bg-fill'
            : phase === 'pre'
              ? 'bg-bg-alt'
              : 'bg-bg-alt'
        }`}
      >
        <p className="text-label-alternative text-[11px] font-medium">
          사이클 시작
        </p>
        <p className="text-label-strong mt-1 text-[12px] tabular-nums">
          {formatKst(topic.cycle_starts_at)}
        </p>
      </li>
      <li
        className={`rounded-[10px] p-3 ${
          phase === 'ended'
            ? 'bg-fill'
            : phase === 'active'
              ? 'bg-primary/5 border-primary border'
              : 'bg-bg-alt'
        }`}
      >
        <p
          className={`text-[11px] font-medium ${
            phase === 'active' ? 'text-primary' : 'text-label-alternative'
          }`}
        >
          결론 발표
        </p>
        <p className="text-label-strong mt-1 text-[12px] tabular-nums">
          {formatKst(topic.cycle_ends_at)}
        </p>
      </li>
    </ol>
  );
}
