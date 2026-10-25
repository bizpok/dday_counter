import React, { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Search,
  Sparkles,
  User as UserIcon,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatByteSize } from '../lib/imageCompression';
import { translateAuthError } from '../lib/supabase';

export type AuthMode = 'login' | 'signup';
export type RecoveryTab = 'findId' | 'resetPassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export function validateAuthInput(
  mode: AuthMode,
  email: string,
  password: string,
  confirmPassword?: string,
): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return '이메일 주소를 입력해 주세요.';
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return '올바른 이메일 주소 형식이 아닙니다. (예: user@example.com)';
  }
  if (!password) {
    return '비밀번호를 입력해 주세요.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (mode === 'signup' && confirmPassword !== undefined && password !== confirmPassword) {
    return '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
  }
  return null;
}

/**
 * 아이디 찾기 & 비밀번호 재설정 모달 (dodo_project 동일 로직)
 */
export function AccountRecoveryModal({
  open,
  initialTab = 'findId',
  onClose,
  onUseEmail,
}: {
  open: boolean;
  initialTab?: RecoveryTab;
  onClose: () => void;
  onUseEmail?: (email: string) => void;
}) {
  const { findEmailsByName, sendPasswordReset } = useAuth();
  const [tab, setTab] = useState<RecoveryTab>(initialTab);

  const [name, setName] = useState('');
  const [found, setFound] = useState<{ masked_email: string; created_at: string }[] | null>(null);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setFound(null);
      setSentTo(null);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const switchTab = (t: RecoveryTab) => {
    setTab(t);
    setError(null);
  };

  const handleFindId = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFound(null);
    if (name.trim().length < 2) {
      setError('가입 시 입력한 이름/닉네임을 2자 이상 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await findEmailsByName(name);
      if (!res.ok) {
        setError(res.error ?? '아이디 찾기에 실패했습니다.');
        return;
      }
      setFound(res.emails ?? []);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await sendPasswordReset(email);
      if (!res.ok) {
        setError(translateAuthError(res.error));
        return;
      }
      setSentTo(email.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base sm:text-lg font-black text-slate-900">아이디 · 비밀번호 찾기</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => switchTab('findId')}
            className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              tab === 'findId' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
            }`}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => switchTab('resetPassword')}
            className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              tab === 'resetPassword' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
            }`}
          >
            비밀번호 찾기
          </button>
        </div>

        {tab === 'findId' ? (
          <form onSubmit={handleFindId} className="space-y-3.5" noValidate>
            <p className="text-xs leading-relaxed text-slate-600">
              dodo_project와 통합된 회원 아이디는 <b>가입한 이메일 주소</b>입니다. 이름 또는 닉네임을 입력하시면 일부가 가려진 이메일을 안내해 드립니다.
            </p>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="recovery-name">
                이름 / 닉네임
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="recovery-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  placeholder="김준규"
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {found &&
              (found.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                  일치하는 계정을 찾지 못했습니다. 이름을 다시 확인해 주세요.
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> 가입된 아이디 {found.length}건
                  </p>
                  <ul className="space-y-1">
                    {found.map((f) => (
                      <li
                        key={f.masked_email + f.created_at}
                        className="flex items-center justify-between text-xs sm:text-sm"
                      >
                        <span className="font-mono font-bold text-slate-900">{f.masked_email}</span>
                        <span className="text-[11px] text-slate-500">
                          가입일 {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              아이디 찾기
            </button>
          </form>
        ) : sentTo ? (
          <div className="space-y-3.5 text-center py-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Mail className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-900">재설정 메일을 보냈습니다</p>
              <p className="text-xs leading-relaxed text-slate-600">
                <b>{sentTo}</b> 으로 비밀번호 재설정 링크를 발송했습니다.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-extrabold text-slate-700 cursor-pointer"
              >
                다시 보내기
              </button>
              <button
                type="button"
                onClick={() => {
                  onUseEmail?.(sentTo);
                  onClose();
                }}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-extrabold text-white cursor-pointer"
              >
                로그인 화면으로
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-3.5" noValidate>
            <p className="text-xs leading-relaxed text-slate-600">
              가입한 이메일 주소를 입력하시면 <b>비밀번호 재설정 링크</b>를 보내드립니다.
            </p>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="recovery-email">
                이메일 주소
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  placeholder="you@example.com"
                  className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              재설정 메일 보내기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * 비밀번호 재설정 링크 클릭 진입 시 새 비밀번호 설정 모달
 */
export function PasswordRecoveryModal() {
  const {
    isPasswordRecovery,
    clearPasswordRecovery,
    updatePassword,
    recoveryUrlError,
    clearRecoveryUrlError,
  } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = isPasswordRecovery || Boolean(recoveryUrlError);
  if (!isOpen) return null;

  const handleClose = () => {
    clearPasswordRecovery();
    clearRecoveryUrlError();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (pw !== pw2) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      const res = await updatePassword(pw);
      if (!res.ok) {
        setError(translateAuthError(res.error));
        return;
      }
      alert('비밀번호가 성공적으로 변경되었습니다!');
      setPw('');
      setPw2('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            {recoveryUrlError ? '비밀번호 재설정 링크 안내' : '새 비밀번호 설정'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {recoveryUrlError ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-bold text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{recoveryUrlError}</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white cursor-pointer"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3.5" noValidate>
            <p className="text-xs text-slate-600">
              앞으로 로그인에 사용할 <b>새 비밀번호</b>를 입력해 주세요.
            </p>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="new-pw-1">
                새 비밀번호 (6자 이상)
              </label>
              <input
                id="new-pw-1"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                disabled={busy}
                placeholder="••••••"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="new-pw-2">
                새 비밀번호 확인
              </label>
              <input
                id="new-pw-2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                disabled={busy}
                placeholder="••••••"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              비밀번호 변경 적용
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * dodo_project 통합 로그인 / 회원가입 폼 패널 (인라인 또는 모달 내부 공용)
 */
export function AuthFormPanel({
  onSuccess,
  headerTitle,
}: {
  onSuccess?: () => void;
  headerTitle?: string;
}) {
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [recoveryTab, setRecoveryTab] = useState<RecoveryTab | null>(null);

  const isBusy = submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);

    const validationErr = validateAuthInput(
      mode,
      email,
      password,
      mode === 'signup' ? confirmPassword : undefined,
    );
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await signInWithEmail(email, password);
        if (!res.ok) {
          setFormError(translateAuthError(res.error));
          return;
        }
        onSuccess?.();
      } else {
        const res = await signUpWithEmail(email, password, fullName);
        if (!res.ok) {
          setFormError(translateAuthError(res.error));
          return;
        }
        if (res.needsEmailConfirmation) {
          setInfoMsg('회원가입 요청이 완료되었습니다! 이메일 인증 링크를 확인한 뒤 로그인해 주세요.');
          setMode('login');
        } else {
          onSuccess?.();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {headerTitle && (
        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight break-keep">
          {headerTitle}
        </h2>
      )}

      {/* 로그인 / 회원가입 탭 전환 */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            setFormError(null);
            setInfoMsg(null);
            setMode('login');
          }}
          className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition cursor-pointer ${
            mode === 'login' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
          }`}
        >
          이메일 로그인
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            setFormError(null);
            setInfoMsg(null);
            setMode('signup');
          }}
          className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition cursor-pointer ${
            mode === 'signup' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
          }`}
        >
          신규 회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="auth-fullname">
              이름 / 닉네임 (선택)
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isBusy}
                placeholder="홍길동"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="auth-email">
            이메일 주소 *
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isBusy}
              placeholder="you@example.com"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="auth-password">
            비밀번호 * <span className="font-normal text-slate-400">(6자 이상)</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
              placeholder="••••••"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-10 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="auth-confirm">
              비밀번호 확인 *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isBusy}
                placeholder="비밀번호 재입력"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{formError}</span>
          </div>
        )}

        {infoMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{infoMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {mode === 'login' ? (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setRecoveryTab('findId')}
                className="hover:text-blue-600 hover:underline cursor-pointer"
              >
                아이디 찾기
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setRecoveryTab('resetPassword')}
                className="hover:text-blue-600 hover:underline cursor-pointer"
              >
                비밀번호 찾기
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500">
              dodo_project와 동일한 계정으로 연동됩니다.
            </span>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>{mode === 'login' ? '로그인' : '회원가입'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      <AccountRecoveryModal
        open={recoveryTab !== null}
        initialTab={recoveryTab ?? 'findId'}
        onClose={() => setRecoveryTab(null)}
        onUseEmail={setEmail}
      />
    </div>
  );
}

/**
 * 설정 탭 및 프로필 모달에 표시되는 내 계정 프로필 & 회원관리 섹션 (dodo_project 동일 기능)
 */
export function MemberProfileSection({
  anniversaryCount,
  resolutionCount,
  onOpenAuthModal,
}: {
  anniversaryCount: number;
  resolutionCount: number;
  onOpenAuthModal: () => void;
}) {
  const { user, profile, updateProfile, uploadAvatar, changePassword, signOut, deleteAccount } =
    useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<{
    originalBytes: number;
    compressedBytes: number;
    width: number;
    height: number;
  } | null>(null);

  // 비밀번호 변경 모달 상태
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [agreedDelete, setAgreedDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setUsername(profile?.username ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile]);

  if (!user) {
    return (
      <section className="flex flex-col gap-3.5 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/80 via-white to-blue-50/40 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-200/80 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">
              <Sparkles className="h-3 w-3" /> 비로그인 상태
            </span>
            <h2 className="mt-1 text-base sm:text-lg font-black text-slate-900">
              로그인하고 내 기념일·결심을 관리하세요
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAuthModal}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-xs hover:bg-blue-700 cursor-pointer"
        >
          <LogIn className="h-4 w-4" />
          로그인 / 회원가입 열기
        </button>
      </section>
    );
  }

  const displayName =
    profile?.full_name || profile?.username || (user.email ? user.email.split('@')[0] : '사용자');

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const originalBytes = file.size;
    setUploadingAvatar(true);
    setStatusMessage(null);
    try {
      const res = await uploadAvatar(file);
      if (!res.ok || !res.avatarUrl) {
        alert(res.error ?? '아바타 이미지 업로드에 실패했습니다.');
        return;
      }
      setAvatarUrl(res.avatarUrl);
      if (res.byteSize != null && res.width != null && res.height != null) {
        setUploadMeta({
          originalBytes,
          compressedBytes: res.byteSize,
          width: res.width,
          height: res.height,
        });
      }
      setStatusMessage(`아바타 이미지가 ${formatByteSize(res.byteSize ?? 0)}로 압축·저장되었습니다.`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleClearAvatar = async () => {
    setAvatarUrl('');
    setUploadMeta(null);
    const res = await updateProfile({
      full_name: fullName,
      username,
      avatar_url: null,
    });
    if (res.ok) {
      setStatusMessage('아바타 이미지가 초기화되었습니다.');
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setStatusMessage(null);
    try {
      const res = await updateProfile({
        full_name: fullName,
        username,
        avatar_url: avatarUrl || null,
      });
      if (!res.ok) {
        alert(res.error ?? '프로필 저장 중 오류가 발생했습니다.');
        return;
      }
      setStatusMessage('내 프로필 정보가 저장되었습니다.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setPasswordModalError(null);
    setOpenPasswordModal(true);
  };

  const handleSubmitChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordModalError(null);

    if (!currentPassword) {
      setPasswordModalError('기존 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordModalError(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordModalError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordModalError('새 비밀번호는 기존 비밀번호와 다르게 설정해 주세요.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (!res.ok) {
        setPasswordModalError(res.error ?? '비밀번호 변경 중 오류가 발생했습니다.');
        return;
      }
      setOpenPasswordModal(false);
      setStatusMessage('비밀번호가 성공적으로 변경되었습니다.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (confirmText.trim() !== '회원탈퇴' || !agreedDelete) return;
    setDeletingAccount(true);
    try {
      const res = await deleteAccount();
      if (!res.ok) {
        alert(res.error ?? '회원탈퇴 처리 중 오류가 발생했습니다.');
        return;
      }
      setOpenDeleteModal(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-500/20"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                <UserIcon className="h-7 w-7" />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="프로필 사진 변경"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs hover:bg-blue-600 cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base sm:text-lg font-black text-slate-900">
              {displayName}
            </h2>
            <p className="truncate text-xs font-bold text-slate-500">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600 hover:bg-red-100 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>로그아웃</span>
        </button>
      </div>

      {/* 아바타 버튼 & 압축 정보 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <ImagePlus className="h-3.5 w-3.5" /> 사진 변경
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={() => void handleClearAvatar()}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> 사진 초기화
          </button>
        )}
      </div>

      {uploadMeta && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          압축 완료: {formatByteSize(uploadMeta.originalBytes)} ➔{' '}
          <b>{formatByteSize(uploadMeta.compressedBytes)}</b> ({uploadMeta.width}×{uploadMeta.height}px)
        </div>
      )}

      {/* 내 보유 데이터 요약 */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/80">
          <span className="block text-[11px] font-bold text-slate-500">내 기념일</span>
          <span className="text-base font-black text-blue-700 tabular-nums">{anniversaryCount}건</span>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/80">
          <span className="block text-[11px] font-bold text-slate-500">내 결심</span>
          <span className="text-base font-black text-emerald-700 tabular-nums">{resolutionCount}건</span>
        </div>
      </div>

      {/* 프로필 수정 폼 */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 border-t border-slate-100 pt-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="prof-fullname">
              이름 (표시명)
            </label>
            <input
              id="prof-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="김준규"
              className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700" htmlFor="prof-username">
              닉네임 (Username)
            </label>
            <input
              id="prof-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="알렉스준"
              className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenPasswordModal}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-blue-600" />
              <span>비밀번호 변경</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setConfirmText('');
                setAgreedDelete(false);
                setOpenDeleteModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600 cursor-pointer"
            >
              <UserX className="h-3.5 w-3.5" />
              <span>회원탈퇴</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            프로필 저장
          </button>
        </div>
      </form>

      {/* 비밀번호 변경 모달 (기존 비밀번호 검증 후 새 비밀번호 설정) */}
      {openPasswordModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setOpenPasswordModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <KeyRound className="h-5 w-5 text-blue-600" /> 비밀번호 변경
              </h3>
              <button
                type="button"
                onClick={() => setOpenPasswordModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-600">
              보안을 위해 기존 비밀번호를 먼저 확인한 후 새 비밀번호로 변경합니다.
            </p>

            <form onSubmit={handleSubmitChangePassword} className="space-y-3">
              <div>
                <label
                  htmlFor="chg-current-pw"
                  className="mb-1 block text-xs font-extrabold text-slate-700"
                >
                  기존 비밀번호
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="chg-current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="현재 사용 중인 비밀번호"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label={showCurrentPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="chg-new-pw"
                  className="mb-1 block text-xs font-extrabold text-slate-700"
                >
                  새 비밀번호 (6자 이상)
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="chg-new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새로운 비밀번호 입력"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label={showNewPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="chg-confirm-pw"
                  className="mb-1 block text-xs font-extrabold text-slate-700"
                >
                  새 비밀번호 확인
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="chg-confirm-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="새로운 비밀번호 다시 입력"
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              {passwordModalError && (
                <div className="flex items-start gap-1.5 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{passwordModalError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpenPasswordModal(false)}
                  className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-300 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {changingPassword ? '변경 중...' : '비밀번호 변경하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 회원탈퇴 확인 모달 */}
      {openDeleteModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setOpenDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="h-5 w-5" /> 회원탈퇴 확인
              </h3>
              <button
                type="button"
                onClick={() => setOpenDeleteModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              회원탈퇴 시 <b>{user.email}</b> 계정의 기념일({anniversaryCount}건), 결심({resolutionCount}건) 및 프로필 정보가 영구 삭제되며 복구할 수 없습니다.
            </p>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedDelete}
                onChange={(e) => setAgreedDelete(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-red-600"
              />
              <span>모든 데이터 영구 삭제에 동의합니다.</span>
            </label>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700">
                확인을 위해 아래에 <b className="text-red-600">회원탈퇴</b>를 입력해 주세요
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="회원탈퇴"
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenDeleteModal(false)}
                className="flex-1 rounded-xl bg-slate-200 py-2.5 text-xs font-extrabold text-slate-700 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                disabled={confirmText.trim() !== '회원탈퇴' || !agreedDelete || deletingAccount}
                onClick={() => void handleConfirmDeleteAccount()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white disabled:opacity-40 cursor-pointer"
              >
                {deletingAccount ? '탈퇴 처리 중...' : '영구 탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
