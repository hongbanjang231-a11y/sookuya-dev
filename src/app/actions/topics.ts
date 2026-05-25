'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { computeCycle, isMonday } from '@/lib/cycle';
import { requireAdmin } from '@/lib/supabase/admin-check';
import { createClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = [
  'society',
  'tech',
  'lifestyle',
  'culture',
  'economy',
  'education',
  'environment',
] as const;

const VALID_STATUSES = ['candidate', 'active'] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export interface CreateTopicResult {
  error?: string;
}

export async function createTopic(
  formData: FormData,
): Promise<CreateTopicResult> {
  const admin = await requireAdmin();

  const title = formData.get('title')?.toString().trim() ?? '';
  const description = formData.get('description')?.toString().trim() ?? '';
  const category = formData.get('category')?.toString() ?? '';
  const status = formData.get('status')?.toString() ?? '';
  const mondayYmd = formData.get('monday_ymd')?.toString() ?? '';

  if (!title || title.length < 3 || title.length > 100) {
    return { error: '제목은 3~100자여야 합니다' };
  }
  if (!description || description.length < 10) {
    return { error: '설명은 10자 이상 입력해주세요' };
  }
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return { error: '카테고리를 선택해주세요' };
  }
  if (!VALID_STATUSES.includes(status as ValidStatus)) {
    return { error: '상태를 선택해주세요' };
  }
  if (!mondayYmd || !isMonday(mondayYmd)) {
    return { error: '월요일 날짜를 선택해주세요' };
  }

  let cycle;
  try {
    cycle = computeCycle(mondayYmd);
  } catch (e) {
    return { error: e instanceof Error ? e.message : '사이클 계산 실패' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('topics').insert({
    title,
    description,
    category,
    format: 'pro_con',
    status,
    cycle_starts_at: cycle.cycle_starts_at,
    cycle_ends_at: cycle.cycle_ends_at,
    opinion_window_starts_at: cycle.opinion_window_starts_at,
    opinion_window_ends_at: cycle.opinion_window_ends_at,
    vote_window_starts_at: cycle.vote_window_starts_at,
    vote_window_ends_at: cycle.vote_window_ends_at,
    comment_window_ends_at: cycle.comment_window_ends_at,
    created_by: admin.userId,
  });

  if (error) {
    // 동시에 active 1개 제약 위반 등
    if (error.code === '23505' && error.message.includes('one_active_topic_idx')) {
      return {
        error: '이미 진행중(active)인 토픽이 있습니다. 기존 토픽을 archived로 바꾼 후 다시 시도하세요.',
      };
    }
    return { error: `DB 에러: ${error.message}` };
  }

  revalidatePath('/admin/topics');
  redirect('/admin/topics');
}
