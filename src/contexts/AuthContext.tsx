import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  compressImageUnder100KB,
  MAX_AVATAR_BYTES,
} from '../lib/imageCompression';
import {
  clearUserLocalDdayData,
  deleteAllUserDdayDataFromSupabase,
  INITIAL_URL_AUTH_ERROR,
  INITIAL_URL_IS_OAUTH_CALLBACK,
  INITIAL_URL_IS_RECOVERY,
  supabase,
} from '../lib/supabase';

export interface UserProfile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: {
    username?: string;
    full_name?: string;
    avatar_url?: string | null;
  }) => Promise<AuthResult>;
  uploadAvatar: (file: File) => Promise<{
    ok: boolean;
    avatarUrl?: string;
    byteSize?: number;
    width?: number;
    height?: number;
    error?: string;
  }>;
  findEmailsByName: (
    name: string,
  ) => Promise<{
    ok: boolean;
    emails?: { masked_email: string; created_at: string }[];
    error?: string;
  }>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  recoveryUrlError: string | null;
  clearRecoveryUrlError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(INITIAL_URL_IS_RECOVERY);
  const [recoveryUrlError, setRecoveryUrlError] = useState<string | null>(INITIAL_URL_AUTH_ERROR);

  const clearRecoveryUrlError = useCallback(() => setRecoveryUrlError(null), []);

  const fetchOrEnsureProfile = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as UserProfile);
        return;
      }

      const metaAvatar =
        currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null;
      const fallbackProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email ?? null,
        username:
          currentUser.user_metadata?.user_name ||
          `${(currentUser.email ?? 'user').split('@')[0]}_${currentUser.id.slice(0, 4)}`,
        full_name:
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          (currentUser.email ?? '사용자').split('@')[0],
        avatar_url: metaAvatar,
      };

      const { data: inserted } = await supabase
        .from('profiles')
        .upsert(fallbackProfile, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      setProfile((inserted as UserProfile) ?? fallbackProfile);
    } catch {
      setProfile({
        id: currentUser.id,
        email: currentUser.email ?? null,
        username: (currentUser.email ?? 'user').split('@')[0],
        full_name:
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          (currentUser.email ?? '사용자').split('@')[0],
        avatar_url:
          currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        setSession(initialSession);
        const currentUser = initialSession?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          void fetchOrEnsureProfile(currentUser);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        void fetchOrEnsureProfile(nextUser);
        if (
          event !== 'PASSWORD_RECOVERY' &&
          !INITIAL_URL_IS_RECOVERY &&
          typeof window !== 'undefined' &&
          (INITIAL_URL_IS_OAUTH_CALLBACK ||
            window.location.hash.includes('access_token=') ||
            window.location.search.includes('code='))
        ) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchOrEnsureProfile]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName?.trim() || trimmedEmail.split('@')[0],
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      const needsEmailConfirmation = Boolean(data.user && !data.session);
      return { ok: true, needsEmailConfirmation };
    },
    [],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!user) {
      return { ok: false, error: '로그인이 필요합니다.' };
    }
    const targetUserId = user.id;

    try {
      const dataDelRes = await deleteAllUserDdayDataFromSupabase(targetUserId);
      if (!dataDelRes.ok) {
        return { ok: false, error: dataDelRes.error ?? '사용자 데이터 삭제에 실패했습니다.' };
      }

      const { error: rpcError } = await supabase.rpc('delete_own_account');
      if (rpcError) {
        const missingFn =
          rpcError.code === 'PGRST202' ||
          rpcError.message?.includes('Could not find the function');
        if (!missingFn) {
          return { ok: false, error: rpcError.message };
        }
      }

      clearUserLocalDdayData(targetUserId);

      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setSession(null);
      setUser(null);
      setProfile(null);

      return { ok: true };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message ?? '회원탈퇴 처리 중 오류가 발생했습니다.',
      };
    }
  }, [user]);

  const findEmailsByName = useCallback(async (name: string) => {
    const { data, error } = await supabase.rpc('find_masked_emails_by_name', {
      p_name: name.trim(),
    });
    if (error) {
      const missing =
        error.code === 'PGRST202' || error.message?.includes('Could not find the function');
      return {
        ok: false,
        error: missing
          ? '아이디 찾기 기능이 서버에 아직 설정되지 않았습니다.'
          : error.message,
      };
    }
    return { ok: true, emails: (data ?? []) as { masked_email: string; created_at: string }[] };
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };
    setIsPasswordRecovery(false);
    setRecoveryUrlError(null);
    if (
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('type=recovery')
    ) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return { ok: true };
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      if (!user?.email) {
        return { ok: false, error: '로그인이 필요합니다.' };
      }
      if (!currentPassword) {
        return { ok: false, error: '기존 비밀번호를 입력해 주세요.' };
      }
      if (newPassword.length < 6) {
        return { ok: false, error: '새 비밀번호는 최소 6자 이상이어야 합니다.' };
      }
      if (currentPassword === newPassword) {
        return { ok: false, error: '새 비밀번호는 기존 비밀번호와 다르게 입력해 주세요.' };
      }

      // 1) 기존 비밀번호 검증
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        return { ok: false, error: '기존 비밀번호가 일치하지 않습니다.' };
      }

      // 2) 새 비밀번호로 변경
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        return { ok: false, error: updateError.message };
      }

      return { ok: true };
    },
    [user],
  );

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    setRecoveryUrlError(null);
    if (
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('type=recovery')
    ) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchOrEnsureProfile(user);
    }
  }, [user, fetchOrEnsureProfile]);

  const updateProfile = useCallback(
    async (patch: {
      username?: string;
      full_name?: string;
      avatar_url?: string | null;
    }): Promise<AuthResult> => {
      if (!user) return { ok: false, error: '로그인이 필요합니다.' };

      const nextAvatar =
        patch.avatar_url !== undefined
          ? patch.avatar_url?.trim() || null
          : (profile?.avatar_url ?? null);

      const payload = {
        id: user.id,
        email: user.email ?? null,
        username: patch.username?.trim() || profile?.username || null,
        full_name: patch.full_name?.trim() || profile?.full_name || null,
        avatar_url: nextAvatar,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        setProfile(data as UserProfile);
      } else {
        setProfile(payload);
      }
      return { ok: true };
    },
    [user, profile],
  );

  const uploadAvatar = useCallback(
    async (
      file: File,
    ): Promise<{
      ok: boolean;
      avatarUrl?: string;
      byteSize?: number;
      width?: number;
      height?: number;
      error?: string;
    }> => {
      if (!user) {
        return { ok: false, error: '로그인이 필요합니다.' };
      }

      try {
        const compressed = await compressImageUnder100KB(file, MAX_AVATAR_BYTES);
        const ext = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const storagePath = `${user.id}/avatar.${ext}`;
        let finalAvatarUrl = compressed.dataUrl;

        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(storagePath, compressed.blob, {
            contentType: compressed.mimeType,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from('avatars')
            .getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            finalAvatarUrl = `${pubData.publicUrl}?t=${Date.now()}`;
          }
        }

        const saveRes = await updateProfile({ avatar_url: finalAvatarUrl });
        if (!saveRes.ok) {
          return {
            ok: false,
            error: saveRes.error ?? '프로필 이미지 저장 중 오류가 발생했습니다.',
          };
        }

        return {
          ok: true,
          avatarUrl: finalAvatarUrl,
          byteSize: compressed.byteSize,
          width: compressed.width,
          height: compressed.height,
        };
      } catch (err: any) {
        return {
          ok: false,
          error: err?.message ?? '이미지 압축 또는 업로드 중 오류가 발생했습니다.',
        };
      }
    },
    [user, updateProfile],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        deleteAccount,
        refreshProfile,
        updateProfile,
        uploadAvatar,
        findEmailsByName,
        sendPasswordReset,
        updatePassword,
        changePassword,
        isPasswordRecovery,
        clearPasswordRecovery,
        recoveryUrlError,
        clearRecoveryUrlError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
