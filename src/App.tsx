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
} from 'lucide-react';
import {
  calculateAnniversary,
  calculateResolution,
  formatDateInput,
  formatKoreanDate,
  parseLocalDate,
  toLocalMidnight,
} from './lib/calc';
import {
  AnniversaryItem,
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
} from './lib/supabase';

export type TabId = 'home' | 'anniversaries' | 'resolutions' | 'settings';
export type FontScale = 'normal' | 'large' | 'xlarge';
type AnnivFilter = 'all' | 'past' | 'future';
type ResFilter = 'all' | 'in_progress' | 'completed' | 'upcoming';

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
    subtitle: '시작일~완료일 기준 진행률(%) 관리',
    icon: Target,
  },
  {
    id: 'settings',
    label: '설정',
    subtitle: '글씨 크기 시인성 및 Supabase 연동 관리',
    icon: Settings,
  },
];

const FONT_SCALE_OPTIONS: { id: FontScale; label: string; desc: string }[] = [
  { id: 'normal', label: '보통', desc: '깔끔한 기본 크기 (16.5px)' },
  { id: 'large', label: '크게 (권장)', desc: '스마트폰 고시인성 (18px)' },
  { id: 'xlarge', label: '아주 크게', desc: '초특대 큰 글씨 모드 (20px)' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [today, setToday] = useState<Date>(() => toLocalMidnight(new Date()));
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    const saved = localStorage.getItem('dday_font_scale') as FontScale | null;
    return saved || 'large';
  });
  const [hideCompletedOnHome, setHideCompletedOnHome] = useState<boolean>(() => {
    return localStorage.getItem('dday_hide_completed_home') === 'true';
  });

  // 데이터 상태
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncedWithSupabase, setSyncedWithSupabase] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | undefined>(undefined);

  // 기념일 입력 폼 & 필터 상태
  const [annivTitle, setAnnivTitle] = useState<string>('');
  const [annivDate, setAnnivDate] = useState<string>(() => formatDateInput(new Date()));
  const [submittingAnniv, setSubmittingAnniv] = useState<boolean>(false);
  const [annivFilter, setAnnivFilter] = useState<AnnivFilter>('all');

  // 기념일 수정 상태
  const [editingAnnivId, setEditingAnnivId] = useState<number | null>(null);
  const [editAnnivTitle, setEditAnnivTitle] = useState<string>('');
  const [editAnnivDate, setEditAnnivDate] = useState<string>('');

  // 결심 입력 폼 & 필터 상태
  const [resTitle, setResTitle] = useState<string>('');
  const [resStartDate, setResStartDate] = useState<string>(() => formatDateInput(new Date()));
  const [resEndDate, setResEndDate] = useState<string>(() => {
    const now = new Date();
    const after30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    return formatDateInput(after30);
  });
  const [submittingRes, setSubmittingRes] = useState<boolean>(false);
  const [resFormError, setResFormError] = useState<string>('');
  const [resFilter, setResFilter] = useState<ResFilter>('all');

  // 결심 수정 상태
  const [editingResId, setEditingResId] = useState<number | null>(null);
  const [editResTitle, setEditResTitle] = useState<string>('');
  const [editResStart, setEditResStart] = useState<string>('');
  const [editResEnd, setEditResEnd] = useState<string>('');

  // 폰트 스케일 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
    localStorage.setItem('dday_font_scale', fontScale);
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

  const loadData = async () => {
    setLoading(true);
    const result = await fetchAllData();
    setAnniversaries(result.anniversaries);
    setResolutions(result.resolutions);
    setSyncedWithSupabase(result.syncedWithSupabase);
    setSyncError(result.errorMessage);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 기념일 CRUD 핸들러
  const handleAddAnniversary = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = annivTitle.trim();
    if (!trimmed || !annivDate) return;

    setSubmittingAnniv(true);
    await createAnniversary(trimmed, annivDate);
    setAnnivTitle('');
    await loadData();
    setSubmittingAnniv(false);
  };

  const handleSaveEditAnniversary = async (id: number) => {
    const trimmed = editAnnivTitle.trim();
    if (!trimmed || !editAnnivDate) return;
    await updateAnniversary(id, trimmed, editAnnivDate);
    setEditingAnnivId(null);
    await loadData();
  };

  const handleDeleteAnniversary = async (id: number) => {
    await deleteAnniversary(id);
    await loadData();
  };

  // 결심 CRUD 핸들러
  const handleAddResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setResFormError('');
    const trimmed = resTitle.trim();
    if (!trimmed || !resStartDate || !resEndDate) return;

    if (parseLocalDate(resEndDate).getTime() < parseLocalDate(resStartDate).getTime()) {
      setResFormError('결심 완료일자는 시작일자보다 같거나 이후 날짜여야 합니다.');
      return;
    }

    setSubmittingRes(true);
    await createResolution(trimmed, resStartDate, resEndDate);
    setResTitle('');
    await loadData();
    setSubmittingRes(false);
  };

  const handleSaveEditResolution = async (id: number) => {
    const trimmed = editResTitle.trim();
    if (!trimmed || !editResStart || !editResEnd) return;
    if (parseLocalDate(editResEnd).getTime() < parseLocalDate(editResStart).getTime()) {
      alert('완료일자는 시작일자보다 같거나 이후여야 합니다.');
      return;
    }
    await updateResolution(id, trimmed, editResStart, editResEnd);
    setEditingResId(null);
    await loadData();
  };

  const handleDeleteResolution = async (id: number) => {
    await deleteResolution(id);
    await loadData();
  };

  const korWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const todayFormatted = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${korWeekdays[today.getDay()]}요일)`;

  // 실시간 미리보기 계산
  const previewAnniv = annivDate ? calculateAnniversary(annivDate, today) : null;
  const previewRes =
    resStartDate &&
    resEndDate &&
    parseLocalDate(resEndDate).getTime() >= parseLocalDate(resStartDate).getTime()
      ? calculateResolution(resStartDate, resEndDate, today)
      : null;

  // 통계 계산 (홈 탭용)
  const resolutionsWithCalc = resolutions.map((item) => ({
    item,
    calc: calculateResolution(item.start_date, item.end_date, today),
  }));
  const avgResolutionPercent =
    resolutionsWithCalc.length > 0
      ? Math.round(
          resolutionsWithCalc.reduce((acc, cur) => acc + cur.calc.percent, 0) /
            resolutionsWithCalc.length
        )
      : 0;

  const homeVisibleResolutions = hideCompletedOnHome
    ? resolutionsWithCalc.filter((r) => r.calc.status !== 'completed')
    : resolutionsWithCalc;

  // 필터링된 목록
  const filteredAnniversaries = anniversaries.filter((item) => {
    const calc = calculateAnniversary(item.target_date, today);
    if (annivFilter === 'past') return !calc.isFuture;
    if (annivFilter === 'future') return calc.isFuture;
    return true;
  });

  const filteredResolutions = resolutionsWithCalc.filter(({ calc }) => {
    if (resFilter === 'all') return true;
    return calc.status === resFilter;
  });

  const currentTabInfo = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="min-h-dvh bg-slate-100 pb-28">
      {/* 상단 고정 앱 헤더 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
              <CalendarHeart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight text-slate-900">디데이 카운터</h1>
              <p className="text-xs font-extrabold text-slate-500">{currentTabInfo.subtitle}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold ${
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
              onClick={loadData}
              title="데이터 새로고침"
              aria-label="데이터 새로고침"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 스마트폰 최적화 메인 컨테이너 */}
      <main className="mx-auto flex w-full max-w-lg flex-col gap-7 px-4 pt-5 sm:px-6">
        {/* ===================================================================
            탭 1: 홈 (통합 대시보드)
            =================================================================== */}
        {activeTab === 'home' && (
          <div className="flex flex-col gap-7">
            {/* 오늘 날짜 & 전체 요약 히어로 카드 */}
            <section className="rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800 p-6 text-white shadow-lg">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2 text-base font-extrabold text-white">
                <span>오늘 · {todayFormatted}</span>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight">
                소중한 기념일과 목표 달성률을 한눈에 확인하세요
              </p>

              {/* 3열 핵심 요약 수치 */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('anniversaries')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 p-3.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-xs font-extrabold text-blue-100">등록 기념일</span>
                  <span className="mt-1 text-2xl sm:text-3xl font-black text-white">
                    {anniversaries.length}건
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 p-3.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-xs font-extrabold text-blue-100">등록 결심</span>
                  <span className="mt-1 text-2xl sm:text-3xl font-black text-white">
                    {resolutions.length}건
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="flex flex-col items-start rounded-2xl bg-white/15 p-3.5 text-left transition hover:bg-white/25 cursor-pointer"
                >
                  <span className="text-xs font-extrabold text-blue-100">평균 진행률</span>
                  <span className="mt-1 text-2xl sm:text-3xl font-black text-emerald-300">
                    {avgResolutionPercent}%
                  </span>
                </button>
              </div>
            </section>

            {/* 홈 - 기념일 요약 섹션 */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <CalendarHeart className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">나의 기념일</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('anniversaries')}
                  className="inline-flex items-center gap-1 rounded-2xl bg-blue-50 px-4 py-2 text-base font-extrabold text-blue-700 hover:bg-blue-100 cursor-pointer"
                >
                  <span>기념일관리</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {anniversaries.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-xl font-extrabold text-slate-700">
                    등록된 기념일이 없습니다
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('anniversaries')}
                    className="inline-flex min-h-[54px] items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-lg font-black text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="h-5 w-5 stroke-[3]" /> 첫 기념일 등록하기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {anniversaries.map((item) => {
                    const calc = calculateAnniversary(item.target_date, today);
                    return (
                      <article
                        key={item.id}
                        onClick={() => setActiveTab('anniversaries')}
                        className="flex flex-col gap-3 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-xs transition hover:border-blue-400 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-2xl font-black text-slate-900 break-keep">
                            {item.title}
                          </h3>
                          <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-1 text-sm font-extrabold text-slate-600">
                            {formatKoreanDate(item.target_date)}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-3 rounded-2xl bg-blue-50/90 px-5 py-4 border border-blue-100">
                          <span className="text-base font-extrabold text-blue-900">
                            {calc.detailText}
                          </span>
                          <span className="text-4xl sm:text-5xl font-black tracking-tight text-blue-700">
                            {calc.badgeText}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 홈 - 결심 진행률 요약 섹션 */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <Target className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">나의 결심 진행률</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('resolutions')}
                  className="inline-flex items-center gap-1 rounded-2xl bg-emerald-50 px-4 py-2 text-base font-extrabold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                >
                  <span>결심관리</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {homeVisibleResolutions.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-xl font-extrabold text-slate-700">
                    {resolutions.length > 0 && hideCompletedOnHome
                      ? '진행 중인 결심이 없습니다 (완료된 결심 숨김 중)'
                      : '등록된 결심이 없습니다'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('resolutions')}
                    className="inline-flex min-h-[54px] items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-black text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                  >
                    <Plus className="h-5 w-5 stroke-[3]" /> 새 결심 등록하기
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {homeVisibleResolutions.map(({ item, calc }) => (
                    <article
                      key={item.id}
                      onClick={() => setActiveTab('resolutions')}
                      className="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-xs transition hover:border-emerald-400 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`inline-flex w-fit items-center rounded-xl px-3 py-1 text-sm font-black ${
                              calc.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : calc.status === 'upcoming'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {calc.statusLabel}
                          </span>
                          <h3 className="text-2xl font-black text-slate-900 break-keep">
                            {item.title}
                          </h3>
                        </div>
                        <div className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-700">
                          {calc.percent}%
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="h-7 w-full overflow-hidden rounded-full bg-slate-200 p-1 shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                            style={{ width: `${calc.percent}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-base font-extrabold text-slate-600">
                          <span>{calc.detailText}</span>
                          <span>
                            {formatKoreanDate(item.start_date)} ~ {formatKoreanDate(item.end_date)}
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
            =================================================================== */}
        {activeTab === 'anniversaries' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl bg-blue-700 p-6 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">기념일 관리</h2>
                  <p className="mt-1 text-base font-bold text-blue-100">
                    기념일 당일을 1일째로 계산하여 몇 일이 지났는지 보여줍니다
                  </p>
                </div>
                <span className="rounded-2xl bg-white/20 px-4 py-2 text-xl font-black">
                  총 {anniversaries.length}건
                </span>
              </div>
            </div>

            {/* 기념일 등록 카드 */}
            <form
              onSubmit={handleAddAnniversary}
              className="flex flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-xl font-black text-slate-900">새 기념일 등록</h3>

              <div className="flex flex-col gap-2">
                <label htmlFor="anniv-title" className="text-lg font-extrabold text-slate-800">
                  기념일 이름
                </label>
                <input
                  id="anniv-title"
                  type="text"
                  required
                  value={annivTitle}
                  onChange={(e) => setAnnivTitle(e.target.value)}
                  placeholder="예: 우리 처음 만난 날, 결혼 기념일"
                  className="min-h-[58px] w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="anniv-date" className="text-lg font-extrabold text-slate-800">
                    기념일 날짜
                  </label>
                  {previewAnniv && (
                    <span className="rounded-xl bg-blue-50 px-3 py-1 text-base font-black text-blue-700">
                      오늘 기준 {previewAnniv.badgeText}
                    </span>
                  )}
                </div>
                <input
                  id="anniv-date"
                  type="date"
                  required
                  value={annivDate}
                  onChange={(e) => setAnnivDate(e.target.value)}
                  className="min-h-[58px] w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submittingAnniv}
                className="inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-xl font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-6 w-6 stroke-[3]" />
                {submittingAnniv ? '저장 중...' : '기념일 등록하기'}
              </button>
            </form>

            {/* 기념일 필터 탭 */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-200/80 p-1.5">
              {(
                [
                  { id: 'all', label: `전체 (${anniversaries.length})` },
                  {
                    id: 'past',
                    label: `경과일 (${
                      anniversaries.filter((a) => !calculateAnniversary(a.target_date, today).isFuture)
                        .length
                    })`,
                  },
                  {
                    id: 'future',
                    label: `다가오는 날 (${
                      anniversaries.filter((a) => calculateAnniversary(a.target_date, today).isFuture)
                        .length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAnnivFilter(tab.id)}
                  className={`min-h-[46px] rounded-xl text-base font-extrabold transition cursor-pointer ${
                    annivFilter === tab.id
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 기념일 카드 리스트 */}
            <div className="flex flex-col gap-4">
              {filteredAnniversaries.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-9 text-center">
                  <p className="text-xl font-extrabold text-slate-700">
                    표시할 기념일이 없습니다
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-500">
                    위 입력창에서 기념일 이름과 날짜를 등록해 주세요!
                  </p>
                </div>
              ) : (
                filteredAnniversaries.map((item) => {
                  const calc = calculateAnniversary(item.target_date, today);
                  const isEditing = editingAnnivId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-4">
                          <label className="text-base font-extrabold text-slate-700">
                            기념일 이름 수정
                          </label>
                          <input
                            type="text"
                            value={editAnnivTitle}
                            onChange={(e) => setEditAnnivTitle(e.target.value)}
                            className="min-h-[54px] w-full rounded-2xl border-2 border-blue-500 px-4 py-2.5 text-xl font-bold text-slate-900"
                          />
                          <label className="text-base font-extrabold text-slate-700">
                            기념일 날짜 수정
                          </label>
                          <input
                            type="date"
                            value={editAnnivDate}
                            onChange={(e) => setEditAnnivDate(e.target.value)}
                            className="min-h-[54px] w-full rounded-2xl border-2 border-blue-500 px-4 py-2.5 text-xl font-bold text-slate-900"
                          />
                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEditAnniversary(item.id)}
                              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-4 text-lg font-extrabold text-white cursor-pointer"
                            >
                              <Check className="h-5 w-5" /> 수정 완료
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAnnivId(null)}
                              className="inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-slate-200 px-5 text-lg font-extrabold text-slate-700 cursor-pointer"
                            >
                              <X className="h-5 w-5" /> 취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-2xl font-black leading-snug text-slate-900 break-keep">
                              {item.title}
                            </h3>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAnnivId(item.id);
                                  setEditAnnivTitle(item.title);
                                  setEditAnnivDate(item.target_date);
                                }}
                                aria-label="기념일 수정"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnniversary(item.id)}
                                aria-label="기념일 삭제"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-blue-50/90 px-5 py-4 border border-blue-100">
                            <div className="flex flex-col gap-1">
                              <span className="text-base font-extrabold text-slate-600">
                                기념일: {formatKoreanDate(item.target_date)}
                              </span>
                              <span className="text-base font-bold text-blue-800">
                                {calc.detailText}
                              </span>
                            </div>
                            <div className="text-4xl sm:text-5xl font-black tracking-tight text-blue-700">
                              {calc.badgeText}
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
            탭 3: 결심관리
            =================================================================== */}
        {activeTab === 'resolutions' && (
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl bg-emerald-700 p-6 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">결심 관리</h2>
                  <p className="mt-1 text-base font-bold text-emerald-100">
                    시작일자와 완료일자를 등록하면 오늘 기준 진행률(%)을 계산합니다
                  </p>
                </div>
                <span className="rounded-2xl bg-white/20 px-4 py-2 text-xl font-black">
                  총 {resolutions.length}건
                </span>
              </div>
            </div>

            {/* 결심 등록 카드 */}
            <form
              onSubmit={handleAddResolution}
              className="flex flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-xl font-black text-slate-900">새 결심 등록</h3>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="res-title" className="text-lg font-extrabold text-slate-800">
                    결심 제목
                  </label>
                  {previewRes && (
                    <span className="rounded-xl bg-emerald-50 px-3 py-1 text-base font-black text-emerald-700">
                      오늘 기준 {previewRes.percent}% ({previewRes.statusLabel})
                    </span>
                  )}
                </div>
                <input
                  id="res-title"
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="예: 매일 아침 30분 독서하기, 100일 운동 프로젝트"
                  className="min-h-[58px] w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="res-start" className="text-lg font-extrabold text-slate-800">
                    결심 시작일자
                  </label>
                  <input
                    id="res-start"
                    type="date"
                    required
                    value={resStartDate}
                    onChange={(e) => setResStartDate(e.target.value)}
                    className="min-h-[58px] w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="res-end" className="text-lg font-extrabold text-slate-800">
                    결심 완료일자
                  </label>
                  <input
                    id="res-end"
                    type="date"
                    required
                    value={resEndDate}
                    onChange={(e) => setResEndDate(e.target.value)}
                    className="min-h-[58px] w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white"
                  />
                </div>
              </div>

              {resFormError && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-base font-extrabold text-red-600 border border-red-200">
                  {resFormError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingRes}
                className="inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-xl font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-6 w-6 stroke-[3]" />
                {submittingRes ? '저장 중...' : '결심 등록하기'}
              </button>
            </form>

            {/* 결심 상태 필터 */}
            <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-200/80 p-1.5">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'in_progress', label: '진행 중' },
                  { id: 'completed', label: '완료' },
                  { id: 'upcoming', label: '예정' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setResFilter(tab.id)}
                  className={`min-h-[46px] rounded-xl text-base font-extrabold transition cursor-pointer ${
                    resFilter === tab.id
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 결심 카드 리스트 */}
            <div className="flex flex-col gap-4">
              {filteredResolutions.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-9 text-center">
                  <p className="text-xl font-extrabold text-slate-700">
                    표시할 결심 항목이 없습니다
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-500">
                    위 입력창에서 결심 제목과 시작일·완료일을 등록해 보세요!
                  </p>
                </div>
              ) : (
                filteredResolutions.map(({ item, calc }) => {
                  const isEditing = editingResId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-4">
                          <label className="text-base font-extrabold text-slate-700">
                            결심 제목 수정
                          </label>
                          <input
                            type="text"
                            value={editResTitle}
                            onChange={(e) => setEditResTitle(e.target.value)}
                            className="min-h-[54px] w-full rounded-2xl border-2 border-emerald-500 px-4 py-2.5 text-xl font-bold text-slate-900"
                          />
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-sm font-extrabold text-slate-700">
                                시작일자
                              </label>
                              <input
                                type="date"
                                value={editResStart}
                                onChange={(e) => setEditResStart(e.target.value)}
                                className="min-h-[54px] w-full rounded-2xl border-2 border-emerald-500 px-4 py-2.5 text-xl font-bold text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-extrabold text-slate-700">
                                완료일자
                              </label>
                              <input
                                type="date"
                                value={editResEnd}
                                onChange={(e) => setEditResEnd(e.target.value)}
                                className="min-h-[54px] w-full rounded-2xl border-2 border-emerald-500 px-4 py-2.5 text-xl font-bold text-slate-900"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEditResolution(item.id)}
                              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-lg font-extrabold text-white cursor-pointer"
                            >
                              <Check className="h-5 w-5" /> 수정 완료
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingResId(null)}
                              className="inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-slate-200 px-5 text-lg font-extrabold text-slate-700 cursor-pointer"
                            >
                              <X className="h-5 w-5" /> 취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1.5">
                              <span
                                className={`inline-flex w-fit items-center rounded-xl px-3 py-1 text-sm font-black ${
                                  calc.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : calc.status === 'upcoming'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-teal-100 text-teal-800'
                                }`}
                              >
                                {calc.statusLabel}
                              </span>
                              <h3 className="text-2xl font-black leading-snug text-slate-900 break-keep">
                                {item.title}
                              </h3>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingResId(item.id);
                                  setEditResTitle(item.title);
                                  setEditResStart(item.start_date);
                                  setEditResEnd(item.end_date);
                                }}
                                aria-label="결심 수정"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteResolution(item.id)}
                                aria-label="결심 삭제"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-emerald-50/90 px-5 py-4 border border-emerald-100">
                            <div className="flex flex-col gap-1 text-base font-extrabold text-slate-700">
                              <div>시작일: {formatKoreanDate(item.start_date)}</div>
                              <div>완료일: {formatKoreanDate(item.end_date)}</div>
                            </div>
                            <div className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-700">
                              {calc.percent}%
                            </div>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            <div className="h-7 w-full overflow-hidden rounded-full bg-slate-200 p-1 shadow-inner">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                                style={{ width: `${calc.percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-base font-extrabold text-slate-600">
                              <span>{calc.detailText}</span>
                              <span className="text-emerald-700">{calc.percent}%</span>
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
            탭 4: 설정 (시인성 글씨 크기 및 Supabase 연동 상태)
            =================================================================== */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-6">
            {/* 1. 글씨 크기 시인성 조절 카드 */}
            <section className="flex flex-col gap-5 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Type className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">화면 글씨 크기 (시인성 설정)</h2>
                  <p className="text-sm font-bold text-slate-500">
                    스마트폰에서 가장 잘 보이는 글씨 크기를 선택하세요
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {FONT_SCALE_OPTIONS.map((opt) => {
                  const isActive = fontScale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFontScale(opt.id)}
                      className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/80'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="text-xl font-black text-slate-900">{opt.label}</p>
                        <p className="mt-0.5 text-base font-bold text-slate-600">{opt.desc}</p>
                      </div>
                      {isActive && (
                        <CheckCircle2 className="h-7 w-7 shrink-0 text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. 홈 화면 표시 옵션 */}
            <section className="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <EyeOff className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">홈 화면 표시 설정</h2>
                  <p className="text-sm font-bold text-slate-500">
                    대시보드에 표시할 항목 기준을 설정합니다
                  </p>
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 cursor-pointer">
                <div>
                  <span className="block text-lg font-extrabold text-slate-900">
                    완료된 결심(100%) 홈 화면에서 숨기기
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-500">
                    홈 탭에서 진행 중인 결심만 집중해서 볼 수 있습니다
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hideCompletedOnHome}
                  onChange={(e) => setHideCompletedOnHome(e.target.checked)}
                  className="h-6 w-6 shrink-0 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
              </label>
            </section>

            {/* 3. Supabase 클라우드 연동 정보 카드 */}
            <section className="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Supabase 데이터베이스 연동</h2>
                  <p className="text-sm font-bold text-slate-500">
                    dodo_project 클라우드 DB와 실시간 동기화됩니다
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-base font-bold text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">연결 상태</span>
                  <span
                    className={`font-black ${
                      syncedWithSupabase ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {syncedWithSupabase ? '정상 연결됨 (Cloud Sync)' : '로컬 백업 모드'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">프로젝트 ID</span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {SUPABASE_PROJECT_REF}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">엔드포인트</span>
                  <span className="truncate max-w-[210px] font-mono text-sm text-slate-600">
                    {SUPABASE_URL}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">저장된 데이터</span>
                  <span className="font-extrabold text-slate-900">
                    기념일 {anniversaries.length}건 · 결심 {resolutions.length}건
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={loadData}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-5 py-3 text-lg font-extrabold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                Supabase 데이터 지금 동기화하기
              </button>
            </section>
          </div>
        )}
      </main>

      {/* =====================================================================
          스마트폰 하단 고정 4탭 내비게이션 바 ('홈' · '기념일관리' · '결심관리' · '설정')
          ===================================================================== */}
      <nav
        aria-label="하단 메인 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur-md"
      >
        <div className="mx-auto grid w-full max-w-lg grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex min-h-[68px] flex-col items-center justify-center gap-1.5 py-2 transition active:scale-95 cursor-pointer ${
                  isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 h-1.5 w-12 rounded-full bg-blue-600" />
                )}
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.75 : 2} />
                <span className="text-sm font-black leading-none tracking-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
