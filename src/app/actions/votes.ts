'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type VoteValue = 'agree' | 'disagree' | 'unsure';

export interface VoteActionResult {
  error?: string;
}

export async function castVote(
  opinionId: string,
  vote: VoteValue,
): Promise<VoteActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const { error } = await supabase.from('opinion_votes').upsert(
    {
      opinion_id: opinionId,
      voter_id: user.id,
      vote,
    },
    { onConflict: 'opinion_id,voter_id' },
  );

  if (error) {
    if (error.message?.includes('자기 의견')) {
      return { error: '자기 의견에는 투표할 수 없습니다' };
    }
    return { error: `투표 실패: ${error.message}` };
  }

  revalidatePath('/');
  return {};
}

export async function removeVote(
  opinionId: string,
): Promise<VoteActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const { error } = await supabase
    .from('opinion_votes')
    .delete()
    .eq('opinion_id', opinionId)
    .eq('voter_id', user.id);

  if (error) {
    return { error: `투표 취소 실패: ${error.message}` };
  }

  revalidatePath('/');
  return {};
}
