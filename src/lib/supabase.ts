import { createClient } from '@supabase/supabase-js';

/**
 * dodo_project의 Supabase 설정 정보를 참조합니다.
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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface AnniversaryItem {
  id: number;
  title: string;
  target_date: string; // YYYY-MM-DD
  created_at?: string;
}

export interface ResolutionItem {
  id: number;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  created_at?: string;
}

const LOCAL_ANNIV_KEY = 'dday_counter_anniversaries_v1';
const LOCAL_RES_KEY = 'dday_counter_resolutions_v1';

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

export async function fetchAllData(): Promise<{
  anniversaries: AnniversaryItem[];
  resolutions: ResolutionItem[];
  syncedWithSupabase: boolean;
  errorMessage?: string;
}> {
  const [annivRes, resRes] = await Promise.all([
    supabase
      .from('dday_anniversaries')
      .select('*')
      .order('target_date', { ascending: true })
      .order('id', { ascending: false }),
    supabase
      .from('dday_resolutions')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ]);

  if (!annivRes.error && !resRes.error) {
    const anniversaries = (annivRes.data || []) as AnniversaryItem[];
    const resolutions = (resRes.data || []) as ResolutionItem[];
    writeLocal(LOCAL_ANNIV_KEY, anniversaries);
    writeLocal(LOCAL_RES_KEY, resolutions);
    return { anniversaries, resolutions, syncedWithSupabase: true };
  }

  const errMsg = annivRes.error?.message || resRes.error?.message || 'Supabase 조회 실패';
  return {
    anniversaries: readLocal<AnniversaryItem>(LOCAL_ANNIV_KEY),
    resolutions: readLocal<ResolutionItem>(LOCAL_RES_KEY),
    syncedWithSupabase: false,
    errorMessage: errMsg,
  };
}

export async function createAnniversary(
  title: string,
  target_date: string
): Promise<{ item: AnniversaryItem; synced: boolean }> {
  const { data, error } = await supabase
    .from('dday_anniversaries')
    .insert([{ title, target_date }])
    .select()
    .single();

  if (!error && data) {
    return { item: data as AnniversaryItem, synced: true };
  }

  const fallbackItem: AnniversaryItem = {
    id: Date.now(),
    title,
    target_date,
    created_at: new Date().toISOString(),
  };
  const current = readLocal<AnniversaryItem>(LOCAL_ANNIV_KEY);
  writeLocal(LOCAL_ANNIV_KEY, [fallbackItem, ...current]);
  return { item: fallbackItem, synced: false };
}

export async function updateAnniversary(
  id: number,
  title: string,
  target_date: string
): Promise<boolean> {
  const { error } = await supabase
    .from('dday_anniversaries')
    .update({ title, target_date })
    .eq('id', id);

  const current = readLocal<AnniversaryItem>(LOCAL_ANNIV_KEY).map((item) =>
    item.id === id ? { ...item, title, target_date } : item
  );
  writeLocal(LOCAL_ANNIV_KEY, current);
  return !error;
}

export async function deleteAnniversary(id: number): Promise<boolean> {
  const { error } = await supabase.from('dday_anniversaries').delete().eq('id', id);
  const current = readLocal<AnniversaryItem>(LOCAL_ANNIV_KEY).filter((x) => x.id !== id);
  writeLocal(LOCAL_ANNIV_KEY, current);
  return !error;
}

export async function createResolution(
  title: string,
  start_date: string,
  end_date: string
): Promise<{ item: ResolutionItem; synced: boolean }> {
  const { data, error } = await supabase
    .from('dday_resolutions')
    .insert([{ title, start_date, end_date }])
    .select()
    .single();

  if (!error && data) {
    return { item: data as ResolutionItem, synced: true };
  }

  const fallbackItem: ResolutionItem = {
    id: Date.now(),
    title,
    start_date,
    end_date,
    created_at: new Date().toISOString(),
  };
  const current = readLocal<ResolutionItem>(LOCAL_RES_KEY);
  writeLocal(LOCAL_RES_KEY, [fallbackItem, ...current]);
  return { item: fallbackItem, synced: false };
}

export async function updateResolution(
  id: number,
  title: string,
  start_date: string,
  end_date: string
): Promise<boolean> {
  const { error } = await supabase
    .from('dday_resolutions')
    .update({ title, start_date, end_date })
    .eq('id', id);

  const current = readLocal<ResolutionItem>(LOCAL_RES_KEY).map((item) =>
    item.id === id ? { ...item, title, start_date, end_date } : item
  );
  writeLocal(LOCAL_RES_KEY, current);
  return !error;
}

export async function deleteResolution(id: number): Promise<boolean> {
  const { error } = await supabase.from('dday_resolutions').delete().eq('id', id);
  const current = readLocal<ResolutionItem>(LOCAL_RES_KEY).filter((x) => x.id !== id);
  writeLocal(LOCAL_RES_KEY, current);
  return !error;
}
