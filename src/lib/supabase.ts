import { createClient } from '@supabase/supabase-js';

/**
 * dodo_project의 Supabase 설정 및 회원 테이블(public.profiles)을 공유합니다.
 * Project Ref: vqppnbsjpzcvmzgwiuaf
 */
const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
export const SUPABASE_PROJECT_REF = 'vqppnbsjpzcvmzgwiuaf';
export const SUPABASE_URL =
  metaEnv?.VITE_SUPABASE_URL || `https://${SUPABASE_PROJECT_REF}.supabase.co`;
export const SUPABASE_ANON_KEY =
  metaEnv?.VITE_SUPABASE_ANON_KEY ||
  metaEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_xAOvIpwGZAdq8r532GXVXA_9VjG5wB0';

/**
 * Supabase Auth 설정에서 Google OAuth Provider 활성화 여부 확인.
 */
export async function checkGoogleProviderEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return true;
    const data = await res.json();
    return Boolean(data?.external?.google);
  } catch {
    return true;
  }
}

/**
 * 비밀번호 재설정 링크, OAuth 콜백 또는 인증 에러 조기 감지.
 */
function checkRecoveryUrl(): {
  isRecovery: boolean;
  isOAuthCallback: boolean;
  authError: string | null;
} {
  if (typeof window === 'undefined') {
    return { isRecovery: false, isOAuthCallback: false, authError: null };
  }
  const href = window.location.href;
  const hash = window.location.hash;
  const search = window.location.search;
  const full = `${href} ${hash} ${search}`;

  const isRecovery =
    /(?:[#&?]|^)type=recovery(?:[&]|$)/.test(full) || full.includes('type=recovery');

  const isOAuthCallback =
    !isRecovery &&
    (hash.includes('access_token=') ||
      hash.includes('provider_token=') ||
      search.includes('code='));

  let authError: string | null = null;
  const errMatch = full.match(/error_description=([^&]+)/);
  if (errMatch) {
    const raw = decodeURIComponent(errMatch[1].replace(/\+/g, ' '));
    if (raw.toLowerCase().includes('expired') || raw.toLowerCase().includes('invalid')) {
      authError =
        '비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. [비밀번호 찾기]에서 재설정 메일을 다시 요청해 주세요.';
    } else {
      authError = raw;
    }
  }

  return { isRecovery, isOAuthCallback, authError };
}

const {
  isRecovery: _initIsRecovery,
  isOAuthCallback: _initIsOAuthCallback,
  authError: _initAuthError,
} = checkRecoveryUrl();
export const INITIAL_URL_IS_RECOVERY = _initIsRecovery;
export const INITIAL_URL_IS_OAUTH_CALLBACK = _initIsOAuthCallback;
export const INITIAL_URL_AUTH_ERROR = _initAuthError;

export function translateAuthError(message?: string): string {
  if (!message) return '인증 처리 중 오류가 발생했습니다.';
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (m.includes('email not confirmed')) {
    return '이메일 인증이 아직 완료되지 않았습니다. 메일함을 확인해 주세요.';
  }
  if (m.includes('user already registered')) {
    return '이미 가입된 이메일 주소입니다. 로그인해 주세요.';
  }
  if (m.includes('password should be at least')) {
    return '비밀번호는 최소 6자 이상이어야 합니다.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  return message;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type CheckStatus = 'success' | 'fail';
export type CheckLogs = Record<string, CheckStatus>;

export interface AnniversaryItem {
  id: number;
  user_id?: string;
  title: string;
  target_date: string; // YYYY-MM-DD
  created_at?: string;
}

export interface ResolutionItem {
  id: number;
  user_id?: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  check_logs?: CheckLogs;
  created_at?: string;
}

const getAnnivKey = (userId?: string | null) =>
  `dday_counter_anniversaries_${userId || 'guest'}`;
const getResKey = (userId?: string | null) =>
  `dday_counter_resolutions_${userId || 'guest'}`;
const getChecksKey = (userId?: string | null) =>
  `dday_counter_res_checks_${userId || 'guest'}`;

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

function readLocalChecksMap(userId?: string | null): Record<number, CheckLogs> {
  try {
    return JSON.parse(localStorage.getItem(getChecksKey(userId)) || '{}') as Record<
      number,
      CheckLogs
    >;
  } catch {
    return {};
  }
}

function writeLocalChecksMap(userId: string | null | undefined, map: Record<number, CheckLogs>): void {
  try {
    localStorage.setItem(getChecksKey(userId), JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function mergeResolutionChecks(userId: string | null | undefined, items: ResolutionItem[]): ResolutionItem[] {
  const localChecks = readLocalChecksMap(userId);
  let updatedMap = false;

  const merged = items.map((item) => {
    const dbLogs =
      item.check_logs && typeof item.check_logs === 'object' ? item.check_logs : undefined;
    const savedLocal = localChecks[item.id];
    const effectiveLogs: CheckLogs =
      dbLogs && Object.keys(dbLogs).length > 0
        ? { ...(savedLocal || {}), ...dbLogs }
        : savedLocal || dbLogs || {};

    if (Object.keys(effectiveLogs).length > 0 && !savedLocal) {
      localChecks[item.id] = effectiveLogs;
      updatedMap = true;
    }

    return {
      ...item,
      check_logs: effectiveLogs,
    };
  });

  if (updatedMap) {
    writeLocalChecksMap(userId, localChecks);
  }
  return merged;
}

export async function fetchAllData(userId?: string | null): Promise<{
  anniversaries: AnniversaryItem[];
  resolutions: ResolutionItem[];
  syncedWithSupabase: boolean;
  errorMessage?: string;
}> {
  // 비로그인 상태일 때는 게스트 로컬 스토리지 데이터만 반환 (타인의 클라우드 데이터 노출 방지)
  if (!userId) {
    return {
      anniversaries: readLocal<AnniversaryItem>(getAnnivKey(null)),
      resolutions: mergeResolutionChecks(null, readLocal<ResolutionItem>(getResKey(null))),
      syncedWithSupabase: false,
    };
  }

  const [annivRes, resRes] = await Promise.all([
    supabase
      .from('dday_anniversaries')
      .select('*')
      .eq('user_id', userId)
      .order('target_date', { ascending: true })
      .order('id', { ascending: false }),
    supabase
      .from('dday_resolutions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);

  if (!annivRes.error && !resRes.error) {
    const anniversaries = (annivRes.data || []) as AnniversaryItem[];
    const resolutions = mergeResolutionChecks(userId, (resRes.data || []) as ResolutionItem[]);
    writeLocal(getAnnivKey(userId), anniversaries);
    writeLocal(getResKey(userId), resolutions);
    return { anniversaries, resolutions, syncedWithSupabase: true };
  }

  const errMsg = annivRes.error?.message || resRes.error?.message || 'Supabase 조회 실패';
  return {
    anniversaries: readLocal<AnniversaryItem>(getAnnivKey(userId)),
    resolutions: mergeResolutionChecks(userId, readLocal<ResolutionItem>(getResKey(userId))),
    syncedWithSupabase: false,
    errorMessage: errMsg,
  };
}

export async function createAnniversary(
  title: string,
  target_date: string,
  userId?: string | null
): Promise<{ item: AnniversaryItem; synced: boolean }> {
  if (userId) {
    const { data, error } = await supabase
      .from('dday_anniversaries')
      .insert([{ user_id: userId, title, target_date }])
      .select()
      .single();

    if (!error && data) {
      return { item: data as AnniversaryItem, synced: true };
    }
  }

  const fallbackItem: AnniversaryItem = {
    id: Date.now(),
    user_id: userId || undefined,
    title,
    target_date,
    created_at: new Date().toISOString(),
  };
  const current = readLocal<AnniversaryItem>(getAnnivKey(userId));
  writeLocal(getAnnivKey(userId), [fallbackItem, ...current]);
  return { item: fallbackItem, synced: false };
}

export async function updateAnniversary(
  id: number,
  title: string,
  target_date: string,
  userId?: string | null
): Promise<boolean> {
  let synced = false;
  if (userId) {
    const { error } = await supabase
      .from('dday_anniversaries')
      .update({ title, target_date })
      .eq('id', id)
      .eq('user_id', userId);
    synced = !error;
  }

  const current = readLocal<AnniversaryItem>(getAnnivKey(userId)).map((item) =>
    item.id === id ? { ...item, title, target_date } : item
  );
  writeLocal(getAnnivKey(userId), current);
  return synced;
}

export async function deleteAnniversary(id: number, userId?: string | null): Promise<boolean> {
  let synced = false;
  if (userId) {
    const { error } = await supabase
      .from('dday_anniversaries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    synced = !error;
  }
  const current = readLocal<AnniversaryItem>(getAnnivKey(userId)).filter((x) => x.id !== id);
  writeLocal(getAnnivKey(userId), current);
  return synced;
}

export async function createResolution(
  title: string,
  start_date: string,
  end_date: string,
  userId?: string | null
): Promise<{ item: ResolutionItem; synced: boolean }> {
  if (userId) {
    const { data, error } = await supabase
      .from('dday_resolutions')
      .insert([{ user_id: userId, title, start_date, end_date, check_logs: {} }])
      .select()
      .single();

    if (!error && data) {
      const created: ResolutionItem = {
        ...(data as ResolutionItem),
        check_logs: (data as ResolutionItem).check_logs || {},
      };
      return { item: created, synced: true };
    }
  }

  const fallbackItem: ResolutionItem = {
    id: Date.now(),
    user_id: userId || undefined,
    title,
    start_date,
    end_date,
    check_logs: {},
    created_at: new Date().toISOString(),
  };
  const current = readLocal<ResolutionItem>(getResKey(userId));
  writeLocal(getResKey(userId), [fallbackItem, ...current]);
  return { item: fallbackItem, synced: false };
}

export async function updateResolution(
  id: number,
  title: string,
  start_date: string,
  end_date: string,
  userId?: string | null
): Promise<boolean> {
  let synced = false;
  if (userId) {
    const { error } = await supabase
      .from('dday_resolutions')
      .update({ title, start_date, end_date })
      .eq('id', id)
      .eq('user_id', userId);
    synced = !error;
  }

  const current = readLocal<ResolutionItem>(getResKey(userId)).map((item) =>
    item.id === id ? { ...item, title, start_date, end_date } : item
  );
  writeLocal(getResKey(userId), current);
  return synced;
}

export async function updateResolutionCheckLogs(
  id: number,
  check_logs: CheckLogs,
  userId?: string | null
): Promise<boolean> {
  const checksMap = readLocalChecksMap(userId);
  checksMap[id] = check_logs;
  writeLocalChecksMap(userId, checksMap);

  const current = readLocal<ResolutionItem>(getResKey(userId)).map((item) =>
    item.id === id ? { ...item, check_logs } : item
  );
  writeLocal(getResKey(userId), current);

  if (userId) {
    const { error } = await supabase
      .from('dday_resolutions')
      .update({ check_logs })
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }
  return false;
}

export async function deleteResolution(id: number, userId?: string | null): Promise<boolean> {
  let synced = false;
  if (userId) {
    const { error } = await supabase
      .from('dday_resolutions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    synced = !error;
  }
  const current = readLocal<ResolutionItem>(getResKey(userId)).filter((x) => x.id !== id);
  writeLocal(getResKey(userId), current);

  const checksMap = readLocalChecksMap(userId);
  delete checksMap[id];
  writeLocalChecksMap(userId, checksMap);

  return synced;
}

export async function deleteAllUserDdayDataFromSupabase(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const [aRes, rRes] = await Promise.all([
    supabase.from('dday_anniversaries').delete().eq('user_id', userId),
    supabase.from('dday_resolutions').delete().eq('user_id', userId),
  ]);
  if (aRes.error || rRes.error) {
    return {
      ok: false,
      error: aRes.error?.message || rRes.error?.message || '데이터 삭제 중 오류가 발생했습니다.',
    };
  }
  return { ok: true };
}

export function clearUserLocalDdayData(userId: string): void {
  try {
    localStorage.removeItem(getAnnivKey(userId));
    localStorage.removeItem(getResKey(userId));
    localStorage.removeItem(getChecksKey(userId));
  } catch {
    // ignore
  }
}
