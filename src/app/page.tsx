import Link from 'next/link';

import type { VoteValue } from '@/app/actions/votes';
import { LoginButtons } from '@/components/auth/login-buttons';
import { OpinionDisplay } from '@/components/opinion/opinion-display';
import { OpinionForm } from '@/components/opinion/opinion-form';
import {
  OpinionsList,
  type OpinionListItem,
} from '@/components/opinion/opinions-list';
import { HeaderUser } from '@/components/site/header-user';
import {
  ActiveTopicCard,
  type ActiveTopic,
} from '@/components/topic/active-topic-card';
import { getCyclePhase } from '@/lib/cycle';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 프로필 (닉네임 + admin 여부)
  let headerUserData = null as null | { nickname: string; isAdmin: boolean };
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, is_admin')
      .eq('id', user.id)
      .single();
    if (profile) {
      headerUserData = {
        nickname: profile.nickname,
        isAdmin: profile.is_admin,
      };
    }
  }

  // active 토픽 (UNIQUE 인덱스로 0~1개)
  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, description, category, cycle_starts_at, cycle_ends_at')
    .eq('status', 'active')
    .maybeSingle();

  // 현재 사용자의 의견 (있으면)
  let myOpinion = null;
  if (user && topic) {
    const { data } = await supabase
      .from('opinions')
      .select(
        'id, body, agree_count, disagree_count, unsure_count, comment_count, created_at, updated_at, status',
      )
      .eq('topic_id', topic.id)
      .eq('author_id', user.id)
      .maybeSingle();
    if (data && data.status !== 'deleted') {
      myOpinion = data;
    }
  }

  // 다른 사람들의 의견 (published만, 자기 의견 제외, 최신순)
  let othersOpinions: OpinionListItem[] = [];
  let myVotes: Record<string, VoteValue> = {};
  if (topic) {
    let query = supabase
      .from('opinions')
      .select(
        'id, body, agree_count, disagree_count, unsure_count, comment_count, created_at, updated_at, author:profiles!opinions_author_id_fkey(nickname)',
      )
      .eq('topic_id', topic.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (user) query = query.neq('author_id', user.id);

    const { data: rows } = await query;
    if (rows) {
      othersOpinions = rows.map((r) => {
        const author = r.author as unknown as { nickname: string } | null;
        return {
          id: r.id,
          body: r.body,
          agree_count: r.agree_count,
          disagree_count: r.disagree_count,
          unsure_count: r.unsure_count,
          comment_count: r.comment_count,
          created_at: r.created_at,
          updated_at: r.updated_at,
          author_nickname: author?.nickname ?? '익명',
        };
      });
    }

    // 내 vote 매핑
    if (user && othersOpinions.length > 0) {
      const ids = othersOpinions.map((o) => o.id);
      const { data: voteRows } = await supabase
        .from('opinion_votes')
        .select('opinion_id, vote')
        .eq('voter_id', user.id)
        .in('opinion_id', ids);
      if (voteRows) {
        myVotes = Object.fromEntries(
          voteRows.map((v) => [v.opinion_id, v.vote as VoteValue]),
        );
      }
    }
  }

  const phase = topic
    ? getCyclePhase(topic as ActiveTopic)
    : null;
  const canVote = !!user && phase?.phase === 'active';
  const cantVoteReason = !user
    ? '로그인하면 투표할 수 있어요'
    : phase?.phase === 'pre'
      ? '사이클 시작 후 투표할 수 있어요'
      : phase?.phase === 'ended'
        ? '사이클이 종료되어 투표할 수 없어요'
        : undefined;

  return (
    <main className="bg-bg-alt min-h-screen">
      <header className="border-line-subtle border-b">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-label-strong text-[20px] font-bold tracking-tight"
          >
            숙의야
          </Link>
          <HeaderUser user={headerUserData} />
        </div>
      </header>

      <section className="mx-auto max-w-[720px] px-5 py-12">
        {topic ? (
          <div className="flex flex-col gap-6">
            <ActiveTopicCard topic={topic as ActiveTopic} />
            <OpinionSection
              topic={topic as ActiveTopic}
              user={user}
              myOpinion={myOpinion}
            />
            <OpinionsList
              opinions={othersOpinions}
              myVotes={myVotes}
              canVote={canVote}
              cantVoteReason={cantVoteReason}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border-line bg-bg-elevated rounded-[16px] border p-10 text-center shadow-sm">
      <p className="text-label-strong text-[18px] font-bold">
        이번 주 주제 준비 중
      </p>
      <p className="text-label-neutral mt-2 text-[14px] leading-relaxed">
        매주 월요일 0시에 새로운 주제가 열립니다.
        <br />곧 만나요.
      </p>
    </div>
  );
}

function OpinionSection({
  topic,
  user,
  myOpinion,
}: {
  topic: ActiveTopic;
  user: { id: string } | null;
  myOpinion: {
    id: string;
    body: string;
    agree_count: number;
    disagree_count: number;
    unsure_count: number;
    comment_count: number;
    created_at: string;
    updated_at: string;
  } | null;
}) {
  const phase = getCyclePhase(topic);
  const inActiveCycle = phase.phase === 'active';

  // 1. 비로그인
  if (!user) {
    return (
      <div className="border-line bg-bg-elevated flex flex-col items-center gap-4 rounded-[16px] border p-8 shadow-sm">
        <p className="text-label-strong text-[16px] font-bold">
          토론에 참여하려면 로그인하세요
        </p>
        <LoginButtons />
      </div>
    );
  }

  // 2. 의견 있음
  if (myOpinion) {
    return (
      <div className="border-line bg-bg-elevated rounded-[16px] border p-6 shadow-sm">
        <OpinionDisplay
          opinion={myOpinion}
          topicId={topic.id}
          canEdit={inActiveCycle}
        />
      </div>
    );
  }

  // 3. 의견 없음 + 사이클 진행 중
  if (inActiveCycle) {
    return (
      <div className="border-line bg-bg-elevated rounded-[16px] border p-6 shadow-sm">
        <OpinionForm topicId={topic.id} />
      </div>
    );
  }

  // 4. 의견 없음 + 사이클 외 (시작 전 또는 종료)
  return (
    <div className="border-line bg-bg-elevated rounded-[16px] border p-6 text-center shadow-sm">
      <p className="text-label-neutral text-[14px]">
        {phase.phase === 'pre'
          ? '주제가 곧 시작됩니다. 사이클 시작 후 의견을 등록할 수 있어요.'
          : '사이클이 종료되었습니다.'}
      </p>
    </div>
  );
}
