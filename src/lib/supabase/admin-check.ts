import { redirect } from 'next/navigation';

import { createClient } from './server';

export interface AdminContext {
  userId: string;
  nickname: string;
  email: string;
}

/**
 * Server Component / Server Action에서 호출. 관리자 인증 강제.
 * - 미로그인 → / 로 redirect
 * - is_admin = false → / 로 redirect
 * - 통과 시 사용자 컨텍스트 반환
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, nickname, email')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/');
  }

  return {
    userId: user.id,
    nickname: profile.nickname,
    email: profile.email,
  };
}
