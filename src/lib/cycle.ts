/**
 * 사이클 timestamp 자동 계산
 * 입력: 월요일 날짜 (YYYY-MM-DD, KST 기준)
 * 출력: 7개 timestamp (모두 KST 기준, ISO 8601 with +09:00 offset)
 *
 * 표준 사이클 (PRD F1, F3, F4, F5, F8):
 *   - 월 00:00 KST  → cycle_starts_at
 *   - 화 00:00 KST  → opinion_window_starts_at
 *   - 수 23:59:59   → opinion_window_ends_at
 *   - 목 00:00      → vote_window_starts_at
 *   - 토 23:59:59   → vote_window_ends_at
 *   - 일 22:00      → comment_window_ends_at == cycle_ends_at
 */

export interface CycleTimestamps {
  cycle_starts_at: string;
  cycle_ends_at: string;
  opinion_window_starts_at: string;
  opinion_window_ends_at: string;
  vote_window_starts_at: string;
  vote_window_ends_at: string;
  comment_window_ends_at: string;
}

const KST_OFFSET_HOURS = 9;

/**
 * "YYYY-MM-DD"가 월요일인지 (KST 기준).
 */
export function isMonday(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  // Date.UTC(year, monthIndex, day) → UTC midnight of that day
  // 어떤 시간대에서 보든 day-of-week는 동일
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 1; // 0=Sun, 1=Mon
}

function kstIsoString(
  y: number,
  m: number,
  d: number,
  daysOffset: number,
  hour: number,
  minute = 0,
  second = 0,
): string {
  // KST(UTC+9)의 (h:m:s)는 UTC의 (h-9:m:s)와 동일 (날짜는 자동 보정됨)
  const utc = new Date(
    Date.UTC(y, m - 1, d + daysOffset, hour - KST_OFFSET_HOURS, minute, second),
  );
  // ISO 8601 with KST offset: "2026-06-01T00:00:00+09:00"
  // toISOString()은 항상 UTC(Z)로 반환하므로, 우리는 직접 KST 시각으로 포맷한다
  const pad = (n: number) => String(n).padStart(2, '0');
  const kstYear = utc.getUTCFullYear();
  const kstMonth = utc.getUTCMonth();
  const kstDay = utc.getUTCDate();
  const kstHour = utc.getUTCHours();
  const kstMin = utc.getUTCMinutes();
  const kstSec = utc.getUTCSeconds();
  // 보정: KST 시각으로 다시 변환
  const kst = new Date(
    Date.UTC(kstYear, kstMonth, kstDay, kstHour + KST_OFFSET_HOURS, kstMin, kstSec),
  );
  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` +
    `T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}` +
    `+09:00`
  );
}

/**
 * 월요일 YMD → 표준 사이클 7개 timestamp
 *
 * @throws Error if mondayYmd가 형식 또는 요일 위반
 */
export function computeCycle(mondayYmd: string): CycleTimestamps {
  if (!isMonday(mondayYmd)) {
    throw new Error('월요일 날짜만 입력 가능합니다 (YYYY-MM-DD)');
  }
  const [y, m, d] = mondayYmd.split('-').map(Number);

  return {
    cycle_starts_at: kstIsoString(y, m, d, 0, 0), // 월 00:00
    opinion_window_starts_at: kstIsoString(y, m, d, 1, 0), // 화 00:00
    opinion_window_ends_at: kstIsoString(y, m, d, 2, 23, 59, 59), // 수 23:59:59
    vote_window_starts_at: kstIsoString(y, m, d, 3, 0), // 목 00:00
    vote_window_ends_at: kstIsoString(y, m, d, 5, 23, 59, 59), // 토 23:59:59
    comment_window_ends_at: kstIsoString(y, m, d, 6, 22), // 일 22:00
    cycle_ends_at: kstIsoString(y, m, d, 6, 22), // 일 22:00
  };
}

/**
 * 사이클 단계 판정 (PRD F1, F3, F4, F5 + F11 진행 상태)
 */
export type CyclePhase =
  | 'pre_opinion' // 월요일 — 의견창 시작 전
  | 'opinion' // 화·수 — 의견 작성중
  | 'between_opinion_vote' // 의견창 마감 ~ 투표창 시작 전
  | 'vote' // 목·금·토 — 투표중
  | 'between_vote_end' // 투표창 마감 ~ 결론(일 22시) 전
  | 'ended'; // 일 22시 이후

export interface PhaseInfo {
  phase: CyclePhase;
  label: string; // 사용자 표시용 단계명
  nextLabel?: string; // "의견 마감까지", "투표 시작까지" 등
  nextDeadline?: string; // ISO 8601 timestamp (KST offset)
}

export interface TopicCycleWindows {
  opinion_window_starts_at: string;
  opinion_window_ends_at: string;
  vote_window_starts_at: string;
  vote_window_ends_at: string;
  comment_window_ends_at: string;
}

export function getCyclePhase(
  topic: TopicCycleWindows,
  now: Date = new Date(),
): PhaseInfo {
  const t = now.getTime();
  const opStart = new Date(topic.opinion_window_starts_at).getTime();
  const opEnd = new Date(topic.opinion_window_ends_at).getTime();
  const voStart = new Date(topic.vote_window_starts_at).getTime();
  const voEnd = new Date(topic.vote_window_ends_at).getTime();
  const cmEnd = new Date(topic.comment_window_ends_at).getTime();

  if (t < opStart) {
    return {
      phase: 'pre_opinion',
      label: '주제 발표',
      nextLabel: '의견 작성 시작까지',
      nextDeadline: topic.opinion_window_starts_at,
    };
  }
  if (t <= opEnd) {
    return {
      phase: 'opinion',
      label: '의견 작성 중',
      nextLabel: '의견 마감까지',
      nextDeadline: topic.opinion_window_ends_at,
    };
  }
  if (t < voStart) {
    return {
      phase: 'between_opinion_vote',
      label: '의견 작성 마감',
      nextLabel: '투표 시작까지',
      nextDeadline: topic.vote_window_starts_at,
    };
  }
  if (t <= voEnd) {
    return {
      phase: 'vote',
      label: '의견 투표 중',
      nextLabel: '투표 마감까지',
      nextDeadline: topic.vote_window_ends_at,
    };
  }
  if (t <= cmEnd) {
    return {
      phase: 'between_vote_end',
      label: '결론 임박',
      nextLabel: '결론 발표까지',
      nextDeadline: topic.comment_window_ends_at,
    };
  }
  return {
    phase: 'ended',
    label: '사이클 종료',
  };
}

/**
 * 남은 시간을 한국어 단위로 표시. "3일 5시간", "2시간 14분", "5분", "마감"
 */
export function formatTimeLeft(toIso: string, from: Date = new Date()): string {
  const ms = new Date(toIso).getTime() - from.getTime();
  if (ms <= 0) return '마감';
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  if (mins > 0) return `${mins}분`;
  return '곧';
}

/**
 * KST timestamp (ISO with offset) → 한국식 표시 문자열
 * 예: "2026-06-01T00:00:00+09:00" → "2026.06.01 (월) 00:00"
 */
export function formatKst(iso: string): string {
  const d = new Date(iso);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n: number) => String(n).padStart(2, '0');
  // KST로 보정해서 표시
  const kstMs = d.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dow = weekdays[kst.getUTCDay()];
  const h = kst.getUTCHours();
  const min = kst.getUTCMinutes();
  return `${y}.${pad(m)}.${pad(day)} (${dow}) ${pad(h)}:${pad(min)}`;
}
