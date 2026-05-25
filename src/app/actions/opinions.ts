'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export interface OpinionActionResult {
  error?: string;
  opinionId?: string;
}

const MIN_BODY = 100;
const MAX_BODY = 300;

function validateBody(body: string): string | null {
  const len = [...body].length; // 문자 수 (한글 1자 = 1)
  if (len < MIN_BODY) return `의견은 ${MIN_BODY}자 이상이어야 합니다 (현재 ${len}자)`;
  if (len > MAX_BODY) return `의견은 ${MAX_BODY}자 이하여야 합니다 (현재 ${len}자)`;
  return null;
}

export async function createOpinion(
  formData: FormData,
): Promise<OpinionActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const topicId = formData.get('topic_id')?.toString() ?? '';
  const body = formData.get('body')?.toString() ?? '';

  if (!topicId) return { error: '주제 정보가 없습니다' };

  const bodyError = validateBody(body);
  if (bodyError) return { error: bodyError };

  const { data, error } = await supabase
    .from('opinions')
    .insert({
      topic_id: topicId,
      author_id: user.id,
      body,
      status: 'published',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: '이미 이 주제에 의견을 작성하셨습니다' };
    }
    // RLS WITH CHECK 실패 (윈도우 외) 등
    return { error: `등록 실패: ${error.message}` };
  }

  revalidatePath('/');
  return { opinionId: data?.id };
}

export async function updateOpinion(
  formData: FormData,
): Promise<OpinionActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const opinionId = formData.get('opinion_id')?.toString() ?? '';
  const body = formData.get('body')?.toString() ?? '';

  if (!opinionId) return { error: '의견 정보가 없습니다' };

  const bodyError = validateBody(body);
  if (bodyError) return { error: bodyError };

  const { error } = await supabase
    .from('opinions')
    .update({ body })
    .eq('id', opinionId)
    .eq('author_id', user.id);

  if (error) {
    return { error: `수정 실패: ${error.message}` };
  }

  revalidatePath('/');
  return { opinionId };
}
