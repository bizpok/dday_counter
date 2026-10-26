import React, { useEffect, useState } from 'react';
import {
  Home,
  CalendarHeart,
  Target,
  Settings,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  RefreshCw,
  Database,
  Type,
  ChevronRight,
  CheckCircle2,
  EyeOff,
  CalendarCheck,
  ChevronLeft,
  RotateCcw,
  LogIn,
  User as UserIcon,
} from 'lucide-react';
import {
  AuthFormPanel,
  MemberProfileSection,
  PasswordRecoveryModal,
} from './components/AuthModalAndPanel';
import { useAuth } from './contexts/AuthContext';
import {
  AnniversaryCalculation,
  calculateAnniversary,
  calculateResolution,
  formatDateInput,
  formatKoreanDate,
  isDateInRange,
  parseLocalDate,
  toLocalMidnight,
} from './lib/calc';
import {
  AnniversaryItem,
  CheckLogs,
  CheckStatus,
  ResolutionItem,
  SUPABASE_PROJECT_REF,
  SUPABASE_URL,
  createAnniversary,
  createResolution,
  deleteAnniversary,
  deleteResolution,
  fetchAllData,
  updateAnniversary,
  updateResolution,
  updateResolutionCheckLogs,
} from './lib/supabase';

export type TabId = 'home' | 'anniversaries' | 'resolutions' | 'settings';
export type FontScale = 'normal' | 'large' | 'xlarge';

const TABS: {
  id: TabId;
  label: string;
  subtitle: string;
  icon: typeof Home;
}[] = [
  {
    id: 'home',
    label: '홈',
    subtitle: '기념일 및 결심 통합 대시보드',
    icon: Home,
  },
  {
    id: 'anniversaries',
    label: '기념일관리',
    subtitle: '당일 1일째 기준 경과 일수 관리',
    icon: CalendarHeart,
  },
  {
    id: 'resolutions',
    label: '결심관리',
    subtitle: '기간 내 성공·실패 체크 및 성공율(%) 관리',
    icon: Target,
  },
  {
    id: 'settings',
    label: '설정',
    subtitle: '회원 프로필 및 DB 연동 관리',
    icon: Settings,
  },
];

const FONT_SCALE_OPTIONS: { id: FontScale; label: string; desc: string }[] = [
  { id: 'normal', label: '보통 (권장)', desc: '스마트폰 표준 최적화 크기 (15px)' },
  { id: 'large', label: '크게', desc: '여유롭고 시원한 글씨 크기 (16px)' },
  { id: 'xlarge', label: '아주 크게', desc: '레이아웃 유지 최대 확대 모드 (17.5px)' },
];

export default function App() {
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [today, setToday] = useState<Date>(() => toLocalMidnight(new Date()));
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    const saved = localStorage.getItem('dday_font_scale_v2') as FontScale | null;
    return saved || 'normal';
  });
  const [hideCompletedOnHome, setHideCompletedOnHome] = useState<boolean>(() => {
    return localStorage.getItem('dday_hide_completed_home') === 'true';
  });

  // 로그인/회원가입 모달 상태
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // 데이터 상태
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncedWithSupabase, setSyncedWithSupabase] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | undefined>(undefined);

  // 기념일 등록 모달 & 입력 폼 상태
  const [showAddAnnivModal, setShowAddAnnivModal] = useState<boolean>(false);
  const [annivTitle, setAnnivTitle] = useState<string>('');
  const [annivDate, setAnnivDate] = useState<string>(() => formatDateInput(new Date()));
  const [submittingAnniv, setSubmittingAnniv] = useState<boolean>(false);

  // 기념일 수정 상태
  const [editingAnnivId, setEditingAnnivId] = useState<number | null>(null);
  const [editAnnivTitle, setEditAnnivTitle] = useState<string>('');
  const [editAnnivDate, setEditAnnivDate] = useState<string>('');

  // 결심 등록 모달 & 입력 폼 상태
  const [showAddResModal, setShowAddResModal] = useState<boolean>(false);
  const [resTitle, setResTitle] = useState<string>('');
  const [resStartDate, setResStartDate] = useState<string>(() => formatDateInput(new Date()));
  const [resMotivation, setResMotivation] = useState<string>('');
  const [submittingRes, setSubmittingRes] = useState<boolean>(false);
  const [resFormError, setResFormError] = useState<string>('');

  // 결심 수정 상태
  const [editingResId, setEditingResId] = useState<number | null>(null);
  const [editResTitle, setEditResTitle] = useState<string>('');
  const [editResStart, setEditResStart] = useState<string>('');
  const [editResMotivation, setEditResMotivation] = useState<string>('');

  // 결심 '진행' 캘린더 모달 상태
  const [calendarResId, setCalendarResId] = useState<number | null>(null);
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth());
  const [selectedCalDate, setSelectedCalDate] = useState<string>(() => formatDateInput(new Date()));
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);

  // 폰트 스케일 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
    localStorage.setItem('dday_font_scale_v2', fontScale);
  }, [fontScale]);

  // 홈 화면 완료 결심 숨김 설정 저장
  useEffect(() => {
    localStorage.setItem('dday_hide_completed_home', String(hideCompletedOnHome));
  }, [hideCompletedOnHome]);

  // 자정 변경 감지 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setToday(toLocalMidnight(new Date()));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (targetUserId: string | null = user?.id ?? null) => {
    setLoading(true);
    const result = await fetchAllData(targetUserId);
    setAnniversaries(result.anniversaries);
    setResolutions(result.resolutions);
    setSyncedWithSupabase(result.syncedWithSupabase);
    setSyncError(result.errorMessage);
    setLoading(false);
  };

  // 로그인 사용자(user.id)가 바뀔 때마다 해당 사용자의 기념일/결심 데이터 로드
  useEffect(() => {
    void loadData(user?.id ?? null);
  }, [user?.id]);

  // 기념일 CRUD 핸들러
  const handleAddAnniversary = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = annivTitle.trim();
    if (!trimmed || !annivDate) return;

    setSubmittingAnniv(true);
    await createAnniversary(trimmed, annivDate, user?.id ?? null);
    setAnnivTitle('');
    setShowAddAnnivModal(false);
    await loadData(user?.id ?? null);
    setSubmittingAnniv(false);
  };

  const handleSaveEditAnniversary = async (id: number) => {
    const trimmed = editAnnivTitle.trim();
    if (!trimmed || !editAnnivDate) return;
    await updateAnniversary(id, trimmed, editAnnivDate, user?.id ?? null);
    setEditingAnnivId(null);
    await loadData(user?.id ?? null);
  };

  const handleDeleteAnniversary = async (id: number) => {
    await deleteAnniversary(id, user?.id ?? null);
    await loadData(user?.id ?? null);
  };

  // 결심 CRUD 핸들러
  const handleAddResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setResFormError('');
    const trimmed = resTitle.trim();
    if (!trimmed || !resStartDate) return;

    setSubmittingRes(true);
    await createResolution(trimmed, resStartDate, resMotivation, user?.id ?? null);
    setResTitle('');
    setResMotivation('');
    setShowAddResModal(false);
    await loadData(user?.id ?? null);
    setSubmittingRes(false);
  };

  const handleSaveEditResolution = async (id: number) => {
    const trimmed = editResTitle.trim();
    if (!trimmed || !editResStart) return;
    await updateResolution(id, trimmed, editResStart, editResMotivation, user?.id ?? null);
    setEditingResId(null);
    await loadData(user?.id ?? null);
  };

  const handleDeleteResolution = async (id: number) => {
    await deleteResolution(id, user?.id ?? null);
    if (calendarResId === id) {
      setCalendarResId(null);
    }
    await loadData(user?.id ?? null);
  };

  // '진행' 아이콘 클릭 시 해당 결심의 캘린더 열기
  const handleOpenProgressCalendar = (item: ResolutionItem) => {
    const currentTodayStr = formatDateInput(today);
    const initialDateStr =
      currentTodayStr >= item.start_date ? currentTodayStr : item.start_date;
    const initDate = parseLocalDate(initialDateStr);
    setCalYear(initDate.getFullYear());
    setCalMonth(initDate.getMonth());
    setSelectedCalDate(initialDateStr);
    setCalendarNotice(
      item.start_date > currentTodayStr
        ? '아직 시작되지 않은 결심입니다. 오늘 날짜 이후는 선택할 수 없습니다.'
        : null
    );
    setCalendarResId(item.id);
  };

  // 특정 날짜의 성공/실패 상태 변경 (오늘 이후 날짜는 차단 및 안내 메시지 표시)
  const handleSetDateCheckStatus = async (
    item: ResolutionItem,
    dateStr: string,
    status: CheckStatus | null
  ) => {
    if (dateStr < item.start_date) return;

    const currentTodayStr = formatDateInput(today);
    if (dateStr > currentTodayStr) {
      setCalendarNotice('오늘 날짜 이후는 선택할 수 없습니다. 오늘까지의 진행 내역만 체크해 주세요.');
      return;
    }

    setCalendarNotice(null);

    const nextLogs: CheckLogs = { ...(item.check_logs || {}) };
    if (status === null) {
      delete nextLogs[dateStr];
    } else {
      nextLogs[dateStr] = status;
    }

    // UI 상태 즉시 반영 (낙관적 업데이트)
    setResolutions((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, check_logs: nextLogs } : r))
    );

    await updateResolutionCheckLogs(item.id, nextLogs, user?.id ?? null);
  };

  // 캘린더 날짜 셀 클릭 시: 오늘 이후 날짜는 선택 차단 및 안내 메시지 출력
  const handleCalendarCellClick = (item: ResolutionItem, dateStr: string) => {
    if (dateStr < item.start_date) return;

    const currentTodayStr = formatDateInput(today);
    if (dateStr > currentTodayStr) {
      setCalendarNotice('오늘 날짜 이후는 선택할 수 없습니다. 오늘까지의 진행 내역만 체크해 주세요.');
      return;
    }

    setCalendarNotice(null);
    setSelectedCalDate(dateStr);

    const current = item.check_logs?.[dateStr];
    const nextStatus: CheckStatus | null =
      current === undefined ? 'success' : current === 'success' ? 'fail' : null;
    void handleSetDateCheckStatus(item, dateStr, nextStatus);
  };

  const korWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const todayFormatted = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${korWeekdays[today.getDay()]}요일)`;
  const todayStr = formatDateInput(today);

  // 실시간 미리보기 계산
  const previewAnniv = annivDate ? calculateAnniversary(annivDate, today) : null;

  // 결심별 성공율 계산 (시작일 ~ 오늘까지의 기간 기준: 성공일자 / 기간 * 100)
  const resolutionsWithCalc = resolutions.map((item) => ({
    item,
    calc: calculateResolution(item.start_date, null, today, item.check_logs || {}),
  }));

  const avgResolutionPercent =
    resolutionsWithCalc.length > 0
      ? Math.round(
          resolutionsWithCalc.reduce((acc, cur) => acc + cur.calc.percent, 0) /
            resolutionsWithCalc.length
        )
      : 0;

  const homeVisibleResolutions = hideCompletedOnHome
    ? resolutionsWithCalc.filter((r) => r.calc.percent < 100)
    : resolutionsWithCalc;

  const currentTabInfo = TABS.find((t) => t.id === activeTab) || TABS[0];

  // 현재 열려있는 캘린더 대상 결심
  const activeCalendarResolution =
    calendarResId !== null
      ? resolutionsWithCalc.find((r) => r.item.id === calendarResId) || null
      : null;

  const displayName =
    profile?.full_name || profile?.username || (user?.email ? user.email.split('@')[0] : null);

  // 기념일 우측 배지 렌더링 (숫자와 '일째'가 절대 두 줄로 쪼개지지 않도록 비율 분리, -10% 축소)
  const renderAnniversaryBadge = (calc: AnniversaryCalculation) => {
    if (calc.isFuture) {
      return (
        <span className="shrink-0 whitespace-nowrap font-black tracking-tight tabular-nums text-blue-700 text-[1.35rem] sm:text-[1.6875rem] leading-none">
          {calc.badgeText}
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-baseline whitespace-nowrap text-blue-700 leading-none">
        <span className="text-[1.35rem] sm:text-[1.6875rem] font-black tracking-tight tabular-nums">
          {calc.dayCount.toLocaleString()}
        </span>
        <span className="ml-0.5 text-[0.7875rem] sm:text-[0.9rem] font-extrabold">일째</span>
      </span>
    );
  };

  // 기념일 좌측 보조 설명 렌더링 (+10% 확대, 깔끔한 1줄 표시)
  const renderAnniversaryDetail = (calc: AnniversaryCalculation) => {
    if (calc.isFuture) {
      return (
        <span className="text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-blue-900 break-keep min-w-0">
          기념일까지 {Math.abs(calc.elapsedDays).toLocaleString()}일 남음
        </span>
      );
    }
    if (calc.elapsedDays === 0) {
      return (
        <span className="text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-blue-900 break-keep min-w-0">
          오늘이 기념일 당일입니다 🎉
        </span>
      );
    }
    return (
      <span className="text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-blue-900 break-keep min-w-0">
        기념일로부터 {calc.elapsedDays.toLocaleString()}일 지남
      </span>
    );
  };

  // 월별 달력 셀 생성 도우미
  const buildCalendarDays = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(formatDateInput(new Date(year, month, day)));
    }
    return cells;
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-100 pb-24">
      {/* 상단 고정 앱 헤더 ('설정' 메뉴에서만 DB 연동 상태/새로고침 표시) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
              <CalendarHeart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight text-slate-900 truncate">
                디데이 카운터
              </h1>
              <p className="text-xs font-bold text-slate-500 truncate">{currentTabInfo.subtitle}</p>
            </div>
          </button>

          {activeTab === 'settings' ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${
                  syncedWithSupabase
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    syncedWithSupabase ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                {syncedWithSupabase ? 'DB 연동됨' : '로컬모드'}
              </span>
              <button
                type="button"
                onClick={() => void loadData(user?.id ?? null)}
                title="데이터 새로고침"
                aria-label="데이터 새로고침"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center">
              {user ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-2xs transition hover:border-blue-300 hover:bg-blue-50 whitespace-nowrap cursor-pointer"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName || ''}
                      className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-blue-500/20"
                    />
                  ) : (
                    <UserIcon className="h-4 w-4 shrink-0 text-blue-600" />
                  )}
                  <span className="max-w-[120px] truncate">{displayName}님</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5 shrink-0" />
                  <span>로그인</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 스마트폰 최적화 메인 컨테이너 */}
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-4 sm:px-6">
        {/* ===================================================================
            탭 1: 홈 (통합 대시보드)
            =================================================================== */}
        {activeTab === 'home' && (
          <div className="flex flex-col gap-5">
            {/* 오늘 날짜 & 전체 요약 히어로 카드 */}
            <section className="rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 p-5 text-white shadow-md">
              <div className="flex items-center">
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs sm:text-sm font-extrabold text-white whitespace-nowrap">
                  <span>오늘 · {todayFormatted}</span>
                </div>
              </div>

              <p className="mt-2.5 text-lg sm:text-xl font-black tracking-tight leading-snug break-keep">
                소중한 기념일과 목표 달성률을 한눈에 확인하세요
              </p>

              {/* 3열 핵심 요약 수치 */}
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('anniversaries')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 px-3 py-2.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-[11px] sm:text-xs font-bold text-blue-100 whitespace-nowrap">
                    등록된 기념일
                  </span>
                  <span className="mt-0.5 text-xl sm:text-2xl font-black text-white tabular-nums whitespace-nowrap">
                    {anniversaries.length}건
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 px-3 py-2.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-[11px] sm:text-xs font-bold text-blue-100 whitespace-nowrap">
                    등록된 결심
                  </span>
                  <span className="mt-0.5 text-xl sm:text-2xl font-black text-white tabular-nums whitespace-nowrap">
                    {resolutions.length}건
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 px-3 py-2.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-[11px] sm:text-xs font-bold text-blue-100 whitespace-nowrap">
                    평균 성공율
                  </span>
                  <span className="mt-0.5 text-xl sm:text-2xl font-black text-emerald-300 tabular-nums whitespace-nowrap">
                    {avgResolutionPercent}%
                  </span>
                </button>
              </div>
            </section>

            {/* 비로그인 상태일 때 통합 로그인/회원가입 카드 표시 */}
            {!user && (
              <section className="rounded-3xl border-2 border-amber-300/90 bg-gradient-to-br from-amber-50/70 via-white to-blue-50/40 p-4 sm:p-5 shadow-xs">
                <AuthFormPanel headerTitle="로그인하고 나만의 기념일·결심을 관리하세요" />
              </section>
            )}

            {/* 홈 - 기념일 요약 섹션 */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <CalendarHeart className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">나의 기념일</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('anniversaries')}
                  className="inline-flex items-center gap-0.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs sm:text-sm font-extrabold text-blue-700 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                >
                  <span>기념일관리</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {anniversaries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="text-base font-extrabold text-slate-700">
                    등록된 기념일이 없습니다
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('anniversaries');
                      setShowAddAnnivModal(true);
                    }}
                    className="inline-flex min-h-[46px] items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" /> 첫 기념일 등록하기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {anniversaries.map((item) => {
                    const calc = calculateAnniversary(item.target_date, today);
                    return (
                      <article
                        key={item.id}
                        onClick={() => setActiveTab('anniversaries')}
                        className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-400 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 break-keep min-w-0">
                            {item.title}
                          </h3>
                          <span className="shrink-0 whitespace-nowrap rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            {formatKoreanDate(item.target_date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50/90 px-3.5 py-3 border border-blue-100">
                          {renderAnniversaryDetail(calc)}
                          {renderAnniversaryBadge(calc)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 홈 - 결심 성공율 요약 섹션 */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <Target className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">나의 결심 성공율</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="inline-flex items-center gap-0.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs sm:text-sm font-extrabold text-emerald-700 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                >
                  <span>결심관리</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {homeVisibleResolutions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="text-base font-extrabold text-slate-700">
                    {resolutions.length > 0 && hideCompletedOnHome
                      ? '진행 중인 결심이 없습니다 (100% 달성 결심 숨김 중)'
                      : '등록된 결심이 없습니다'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('resolutions');
                      setShowAddResModal(true);
                    }}
                    className="inline-flex min-h-[46px] items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" /> 새 결심 등록하기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {homeVisibleResolutions.map(({ item, calc }) => (
                    <article
                      key={item.id}
                      onClick={() => handleOpenProgressCalendar(item)}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-emerald-400 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 break-keep min-w-0">
                            {item.title}
                          </h3>
                          {item.motivation && (
                            <p className="mt-0.5 text-[0.825rem] sm:text-[0.9625rem] font-bold text-emerald-700 break-keep">
                              {item.motivation}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex shrink-0 items-baseline whitespace-nowrap text-emerald-700 leading-none">
                          <span className="text-[1.35rem] sm:text-[1.6875rem] font-black tracking-tight tabular-nums">
                            {calc.percent}
                          </span>
                          <span className="ml-0.5 text-[0.7875rem] sm:text-[0.9rem] font-extrabold">%</span>
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200 p-0.5 shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                            style={{ width: `${calc.percent}%` }}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 pt-0.5 text-[0.825rem] sm:text-[0.9625rem] font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-emerald-800 font-extrabold">{calc.detailText}</span>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            시작일: {formatKoreanDate(item.start_date)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            탭 2: 기념일관리
            - (1) 인라인 기념일 등록 폼, 필터 바 삭제 완료
            - '기념일등록' 아이콘 버튼 추가 (클릭 시 모달 오픈)
            =================================================================== */}
        {activeTab === 'anniversaries' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-blue-700 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-black">기념일 관리</h2>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold text-blue-100 break-keep">
                    기념일 당일을 1일째로 계산하여 경과 일수를 보여줍니다
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap rounded-xl bg-white/20 px-3 py-1.5 text-xs sm:text-sm font-black">
                    총 {anniversaries.length}건
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddAnnivModal(true)}
                    title="새 기념일 등록"
                    aria-label="새 기념일 등록"
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-xs sm:text-sm font-black text-blue-700 shadow-xs transition hover:bg-blue-50 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    <span>기념일등록</span>
                  </button>
                </div>
              </div>
            </div>

            {!user && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
                <span>비로그인 상태입니다. 로그인하면 내 계정의 기념일을 불러옵니다.</span>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white cursor-pointer"
                >
                  로그인
                </button>
              </div>
            )}

            {/* 기념일 카드 리스트 */}
            <div className="flex flex-col gap-3">
              {anniversaries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-7 text-center">
                  <p className="text-base font-extrabold text-slate-700">
                    등록된 기념일이 없습니다
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-500">
                    우측 상단의 기념일등록 아이콘을 눌러 첫 기념일을 등록해 주세요!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddAnnivModal(true)}
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" /> 새 기념일 등록하기
                  </button>
                </div>
              ) : (
                anniversaries.map((item) => {
                  const calc = calculateAnniversary(item.target_date, today);
                  const isEditing = editingAnnivId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-extrabold text-slate-700">
                            기념일 이름 수정
                          </label>
                          <input
                            type="text"
                            value={editAnnivTitle}
                            onChange={(e) => setEditAnnivTitle(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border-2 border-blue-500 px-3.5 py-2 text-sm sm:text-base font-bold text-slate-900"
                          />
                          <label className="text-xs font-extrabold text-slate-700">
                            기념일 날짜 수정
                          </label>
                          <input
                            type="date"
                            value={editAnnivDate}
                            onChange={(e) => setEditAnnivDate(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border-2 border-blue-500 px-3.5 py-2 text-sm sm:text-base font-bold text-slate-900"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEditAnniversary(item.id)}
                              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-extrabold text-white cursor-pointer"
                            >
                              <Check className="h-4 w-4" /> 수정 완료
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAnnivId(null)}
                              className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-slate-200 px-4 text-sm font-extrabold text-slate-700 cursor-pointer"
                            >
                              <X className="h-4 w-4" /> 취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base sm:text-lg font-black leading-snug text-slate-900 break-keep">
                                {item.title}
                              </h3>
                              <span className="mt-0.5 block text-[0.825rem] sm:text-[0.9625rem] font-bold text-slate-500">
                                기념일: {formatKoreanDate(item.target_date)}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAnnivId(item.id);
                                  setEditAnnivTitle(item.title);
                                  setEditAnnivDate(item.target_date);
                                }}
                                aria-label="기념일 수정"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAnniversary(item.id)}
                                aria-label="기념일 삭제"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50/90 px-3.5 py-3 border border-blue-100">
                            {renderAnniversaryDetail(calc)}
                            {renderAnniversaryBadge(calc)}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            탭 3: 결심관리
            - (1) 인라인 등록 폼, 필터 바, 상태 배지 삭제 완료
            - 결심등록 아이콘 추가
            - (2) '진행' 아이콘 추가 -> 클릭 시 성공/실패 캘린더 모달 표시 및 성공율 반영
            =================================================================== */}
        {activeTab === 'resolutions' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-emerald-700 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-black">결심 관리</h2>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-100 break-keep">
                    &apos;진행&apos; 아이콘을 눌러 기간 내 성공·실패를 체크하고 성공율(%)을 확인하세요
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap rounded-xl bg-white/20 px-3 py-1.5 text-xs sm:text-sm font-black">
                    총 {resolutions.length}건
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setResFormError('');
                      setShowAddResModal(true);
                    }}
                    title="새 결심 등록"
                    aria-label="새 결심 등록"
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-xs sm:text-sm font-black text-emerald-800 shadow-xs transition hover:bg-emerald-50 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    <span>결심등록</span>
                  </button>
                </div>
              </div>
            </div>

            {!user && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
                <span>비로그인 상태입니다. 로그인하면 내 계정의 결심을 불러옵니다.</span>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white cursor-pointer"
                >
                  로그인
                </button>
              </div>
            )}

            {/* 결심 카드 리스트 */}
            <div className="flex flex-col gap-3">
              {resolutionsWithCalc.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-7 text-center">
                  <p className="text-base font-extrabold text-slate-700">
                    등록된 결심 항목이 없습니다
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-500">
                    우측 상단의 결심등록 아이콘을 눌러 첫 결심을 등록해 보세요!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResFormError('');
                      setShowAddResModal(true);
                    }}
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" /> 새 결심 등록하기
                  </button>
                </div>
              ) : (
                resolutionsWithCalc.map(({ item, calc }) => {
                  const isEditing = editingResId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-emerald-300"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-extrabold text-slate-700">
                            결심 제목 수정
                          </label>
                          <input
                            type="text"
                            value={editResTitle}
                            onChange={(e) => setEditResTitle(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border-2 border-emerald-500 px-3.5 py-2 text-sm sm:text-base font-bold text-slate-900"
                          />
                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-slate-700">
                              결심 시작일자
                            </label>
                            <input
                              type="date"
                              value={editResStart}
                              onChange={(e) => setEditResStart(e.target.value)}
                              className="min-h-[44px] w-full rounded-xl border-2 border-emerald-500 px-3.5 py-2 text-sm sm:text-base font-bold text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-slate-700">
                              결심동기부여
                            </label>
                            <input
                              type="text"
                              value={editResMotivation}
                              onChange={(e) => setEditResMotivation(e.target.value)}
                              placeholder="예: 건강한 몸과 맑은 정신을 위해 꼭 실천하자!"
                              className="min-h-[44px] w-full rounded-xl border-2 border-emerald-500 px-3.5 py-2 text-sm sm:text-base font-bold text-slate-900"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEditResolution(item.id)}
                              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 text-sm font-extrabold text-white cursor-pointer"
                            >
                              <Check className="h-4 w-4" /> 수정 완료
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingResId(null)}
                              className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-slate-200 px-4 text-sm font-extrabold text-slate-700 cursor-pointer"
                            >
                              <X className="h-4 w-4" /> 취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* 상단: 제목 + 우측 (2) '진행' 아이콘 · 수정 · 삭제 */}
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-black leading-snug text-slate-900 break-keep min-w-0">
                              {item.title}
                            </h3>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {/* (2) '진행' 아이콘 버튼 */}
                              <button
                                type="button"
                                onClick={() => handleOpenProgressCalendar(item)}
                                title="진행 캘린더 열기 (성공/실패 체크)"
                                aria-label="진행 캘린더 열기"
                                className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 cursor-pointer whitespace-nowrap"
                              >
                                <CalendarCheck className="h-4 w-4" />
                                <span>진행</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingResId(item.id);
                                  setEditResTitle(item.title);
                                  setEditResStart(item.start_date);
                                  setEditResMotivation(item.motivation || '');
                                }}
                                aria-label="결심 수정"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteResolution(item.id)}
                                aria-label="결심 삭제"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* 중단: 시작일/결심동기부여 및 성공율(%) 표시 박스 */}
                          <div
                            onClick={() => handleOpenProgressCalendar(item)}
                            className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50/90 px-3.5 py-3 border border-emerald-100 cursor-pointer transition hover:border-emerald-300"
                          >
                            <div className="flex flex-col gap-0.5 text-[0.825rem] sm:text-[0.9625rem] font-bold text-slate-700 min-w-0">
                              <div className="truncate">
                                시작일: {formatKoreanDate(item.start_date)}
                              </div>
                              {item.motivation && (
                                <div className="text-emerald-800 font-extrabold break-keep">
                                  동기부여: {item.motivation}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-[11px] font-extrabold text-emerald-700/80 mb-0.5">
                                성공율
                              </span>
                              <span className="inline-flex items-baseline whitespace-nowrap text-emerald-700 leading-none">
                                <span className="text-[1.35rem] sm:text-[1.6875rem] font-black tracking-tight tabular-nums">
                                  {calc.percent}
                                </span>
                                <span className="ml-0.5 text-[0.7875rem] sm:text-[0.9rem] font-extrabold">%</span>
                              </span>
                            </div>
                          </div>

                          {/* 하단: 성공율 프로그레스 바 & 성공/실패 집계 */}
                          <div className="flex flex-col gap-1.5">
                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200 p-0.5 shadow-inner">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                                style={{ width: `${calc.percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-slate-600">
                              <span className="truncate">{calc.detailText}</span>
                              <span className="shrink-0 text-emerald-700 tabular-nums">
                                성공율 {calc.percent}%
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            탭 4: 설정 (회원관리 · 데이터베이스 연동 상태)
            =================================================================== */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-4">
            {/* 0. 내 계정 프로필 & 회원관리 (dodo_project public.profiles 공유) */}
            <MemberProfileSection
              anniversaryCount={anniversaries.length}
              resolutionCount={resolutions.length}
              onOpenAuthModal={() => setShowAuthModal(true)}
            />

            {/* 1. 데이터베이스 연동 정보 카드 */}
            <section className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    데이터베이스 연동
                  </h2>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">연결 상태</span>
                  <span
                    className={`font-black ${
                      syncedWithSupabase ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {syncedWithSupabase ? '정상 연결됨 (Cloud Sync)' : '로컬/게스트 모드'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =====================================================================
          모달: 로그인 / 회원가입 모달
          ===================================================================== */}
      {showAuthModal && !user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                로그인 / 회원가입
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                aria-label="닫기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AuthFormPanel onSuccess={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 링크 진입 모달 */}
      <PasswordRecoveryModal />

      {/* =====================================================================
          모달 0: 새 기념일 등록 모달 ('기념일등록' 아이콘 클릭 시 표시)
          ===================================================================== */}
      {showAddAnnivModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAddAnnivModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Plus className="h-4 w-4 stroke-[3]" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">새 기념일 등록</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAnnivModal(false)}
                aria-label="닫기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAnniversary} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-anniv-title" className="text-xs sm:text-sm font-extrabold text-slate-700">
                  기념일 이름
                </label>
                <input
                  id="modal-anniv-title"
                  type="text"
                  required
                  autoFocus
                  value={annivTitle}
                  onChange={(e) => setAnnivTitle(e.target.value)}
                  placeholder="예: 우리 처음 만난 날, 결혼 기념일"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="modal-anniv-date" className="text-xs sm:text-sm font-extrabold text-slate-700">
                    기념일 날짜
                  </label>
                  {previewAnniv && (
                    <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-black text-blue-700 whitespace-nowrap">
                      오늘 기준 {previewAnniv.badgeText}
                    </span>
                  )}
                </div>
                <input
                  id="modal-anniv-date"
                  type="date"
                  required
                  value={annivDate}
                  onChange={(e) => setAnnivDate(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="mt-1 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingAnniv}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm sm:text-base font-black text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  {submittingAnniv ? '저장 중...' : '기념일 등록하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAnnivModal(false)}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-300 cursor-pointer"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          모달 1: 새 결심 등록 모달 ('결심등록' 아이콘 클릭 시 표시)
          ===================================================================== */}
      {showAddResModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setShowAddResModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Plus className="h-4 w-4 stroke-[3]" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">새 결심 등록</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddResModal(false)}
                aria-label="닫기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddResolution} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-res-title" className="text-xs sm:text-sm font-extrabold text-slate-700">
                  결심 제목
                </label>
                <input
                  id="modal-res-title"
                  type="text"
                  required
                  autoFocus
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="예: 한달 금주, 매일 아침 30분 독서하기"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-res-start" className="text-xs sm:text-sm font-extrabold text-slate-700">
                  결심 시작일자
                </label>
                <input
                  id="modal-res-start"
                  type="date"
                  required
                  value={resStartDate}
                  onChange={(e) => setResStartDate(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="modal-res-motivation" className="text-xs sm:text-sm font-extrabold text-slate-700">
                  결심동기부여
                </label>
                <input
                  id="modal-res-motivation"
                  type="text"
                  value={resMotivation}
                  onChange={(e) => setResMotivation(e.target.value)}
                  placeholder="예: 건강한 몸과 맑은 정신을 위해 꼭 실천하자!"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                />
              </div>

              {resFormError && (
                <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-red-600 border border-red-200">
                  {resFormError}
                </div>
              )}

              <div className="mt-1 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingRes}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm sm:text-base font-black text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  {submittingRes ? '저장 중...' : '결심 등록하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddResModal(false)}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-300 cursor-pointer"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          모달 2: 결심 '진행' 캘린더 모달 ('성공' / '실패' 체크 및 성공율 산출)
          ===================================================================== */}
      {activeCalendarResolution && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs"
          onClick={() => setCalendarResId(null)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-3xl bg-white p-4 sm:p-5 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                  <CalendarCheck className="h-3.5 w-3.5" /> 결심 진행 체크 캘린더
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-black text-slate-900 break-keep">
                  {activeCalendarResolution.item.title}
                </h3>
                <p className="text-[0.825rem] sm:text-[0.9625rem] font-bold text-slate-500">
                  시작일: {formatKoreanDate(activeCalendarResolution.item.start_date)} (진행{' '}
                  {activeCalendarResolution.calc.totalDays}일차)
                </p>
                {activeCalendarResolution.item.motivation && (
                  <p className="mt-0.5 text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-emerald-700 break-keep">
                    동기부여: {activeCalendarResolution.item.motivation}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCalendarResId(null)}
                aria-label="캘린더 닫기"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 상단 성공율 & 성공/실패/미체크 요약 카드 */}
            <div className="mt-3 rounded-2xl bg-emerald-50/90 p-3.5 border border-emerald-100">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[0.825rem] sm:text-[0.9625rem] font-extrabold text-emerald-900">현재 성공율</span>
                  <p className="text-xs font-bold text-emerald-700">
                    진행 {activeCalendarResolution.calc.totalDays}일 중 성공{' '}
                    {activeCalendarResolution.calc.successDays}일
                  </p>
                </div>
                <span className="inline-flex items-baseline whitespace-nowrap text-emerald-700 leading-none">
                  <span className="text-[1.35rem] sm:text-[1.6875rem] font-black tracking-tight tabular-nums">
                    {activeCalendarResolution.calc.percent}
                  </span>
                  <span className="ml-0.5 text-[0.7875rem] sm:text-[0.9rem] font-extrabold">%</span>
                </span>
              </div>

              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
                  style={{ width: `${activeCalendarResolution.calc.percent}%` }}
                />
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white px-2 py-1.5 border border-emerald-200">
                  <span className="block text-[11px] font-bold text-emerald-700">성공</span>
                  <span className="text-sm font-black text-emerald-700 tabular-nums">
                    {activeCalendarResolution.calc.successDays}일
                  </span>
                </div>
                <div className="rounded-xl bg-white px-2 py-1.5 border border-rose-200">
                  <span className="block text-[11px] font-bold text-rose-600">실패</span>
                  <span className="text-sm font-black text-rose-600 tabular-nums">
                    {activeCalendarResolution.calc.failDays}일
                  </span>
                </div>
                <div className="rounded-xl bg-white px-2 py-1.5 border border-slate-200">
                  <span className="block text-[11px] font-bold text-slate-500">미체크</span>
                  <span className="text-sm font-black text-slate-700 tabular-nums">
                    {activeCalendarResolution.calc.uncheckedDays}일
                  </span>
                </div>
              </div>
            </div>

            {/* 월 이동 네비게이션 */}
            <div className="mt-3.5 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="이전 달"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm sm:text-base font-black text-slate-900">
                {calYear}년 {calMonth + 1}월
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="다음 달"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold text-slate-500">
              {korWeekdays.map((w, idx) => (
                <span
                  key={w}
                  className={
                    idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-600' : 'text-slate-500'
                  }
                >
                  {w}
                </span>
              ))}
            </div>

            {/* 달력 날짜 그리드 */}
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildCalendarDays(calYear, calMonth).map((dateStr, idx) => {
                if (!dateStr) {
                  return <div key={`empty-${idx}`} className="h-11 rounded-xl" />;
                }

                const dayNum = Number(dateStr.split('-')[2]);
                const inPeriod = dateStr >= activeCalendarResolution.item.start_date;
                const status = activeCalendarResolution.item.check_logs?.[dateStr];
                const isSelected = selectedCalDate === dateStr;
                const isToday = dateStr === todayStr;
                const isFutureDate = dateStr > todayStr;

                if (!inPeriod) {
                  return (
                    <div
                      key={dateStr}
                      className="flex h-11 flex-col items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-300 select-none"
                    >
                      <span>{dayNum}</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleCalendarCellClick(activeCalendarResolution.item, dateStr)}
                    className={`relative flex h-11 flex-col items-center justify-center rounded-xl border text-xs font-extrabold transition ${
                      isFutureDate
                        ? 'border-dashed border-slate-200 bg-slate-50/90 text-slate-400 cursor-not-allowed'
                        : status === 'success'
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs cursor-pointer'
                        : status === 'fail'
                        ? 'border-rose-500 bg-rose-500 text-white shadow-xs cursor-pointer'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer'
                    } ${isSelected && !isFutureDate ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}
                  >
                    <span className="leading-none tabular-nums">{dayNum}</span>
                    <span className="mt-0.5 text-[10px] font-black leading-none">
                      {isFutureDate
                        ? '예정'
                        : status === 'success'
                        ? '성공'
                        : status === 'fail'
                        ? '실패'
                        : isToday
                        ? '오늘'
                        : '·'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 오늘 이후 날짜 클릭 시 안내 메시지 배너 */}
            {calendarNotice && (
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800">
                <span>⚠️ {calendarNotice}</span>
                <button
                  type="button"
                  onClick={() => setCalendarNotice(null)}
                  className="shrink-0 text-amber-600 hover:text-amber-900 cursor-pointer"
                  aria-label="안내 닫기"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* 선택한 날짜 성공 / 실패 직접 체크 버튼 바 */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 mb-2">
                <span>선택 날짜: {formatKoreanDate(selectedCalDate)}</span>
                <span className="text-[11px] font-bold text-slate-500">
                  오늘까지의 날짜만 체크 가능
                </span>
              </div>

              {selectedCalDate > todayStr ? (
                <p className="text-center text-xs font-extrabold text-amber-700 py-1">
                  오늘 날짜 이후는 선택할 수 없습니다. 오늘까지의 진행 내역만 체크해 주세요.
                </p>
              ) : selectedCalDate >= activeCalendarResolution.item.start_date ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleSetDateCheckStatus(
                        activeCalendarResolution.item,
                        selectedCalDate,
                        'success'
                      )
                    }
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                      activeCalendarResolution.item.check_logs?.[selectedCalDate] === 'success'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Check className="h-4 w-4 stroke-[3]" /> 성공
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSetDateCheckStatus(
                        activeCalendarResolution.item,
                        selectedCalDate,
                        'fail'
                      )
                    }
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                      activeCalendarResolution.item.check_logs?.[selectedCalDate] === 'fail'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'border border-rose-300 bg-white text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    <X className="h-4 w-4 stroke-[3]" /> 실패
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSetDateCheckStatus(
                        activeCalendarResolution.item,
                        selectedCalDate,
                        null
                      )
                    }
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-extrabold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 미체크
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs font-bold text-amber-700 py-1">
                  결심 시작일({formatKoreanDate(activeCalendarResolution.item.start_date)}) 이후 날짜를 선택해 주세요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          스마트폰 하단 고정 4탭 내비게이션 바 ('홈' · '기념일관리' · '결심관리' · '설정')
          ===================================================================== */}
      <nav
        aria-label="하단 메인 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-md"
      >
        <div className="mx-auto grid w-full max-w-lg grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-1.5 transition active:scale-95 cursor-pointer ${
                  isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 h-1 w-10 rounded-full bg-blue-600" />
                )}
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.75 : 2} />
                <span className="text-xs font-extrabold leading-none tracking-tight whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
