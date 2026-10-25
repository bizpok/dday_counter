export const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Date 객체를 로컬 자정(00:00:00)으로 정규화합니다.
 */
export function toLocalMidnight(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 'YYYY-MM-DD' 문자열을 로컬 자정 Date 객체로 변환합니다.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Date 객체를 'YYYY-MM-DD' 문자열로 포맷합니다.
 */
export function formatDateInput(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 'YYYY-MM-DD' 문자열을 'YYYY년 MM월 DD일' 한국어 표기로 변환합니다.
 */
export function formatKoreanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export interface AnniversaryCalculation {
  /** 등록 당일 = 1일째 기준 일수 (오늘 - 기념일 + 1). 미래일 경우 음수 또는 0 이하 */
  dayCount: number;
  /** 순수 경과 일수 (오늘 - 기념일) */
  elapsedDays: number;
  /** 미래 날짜 여부 */
  isFuture: boolean;
  /** 화면에 크게 표시할 메인 텍스트 (예: "1일째", "125일째", "D-7") */
  badgeText: string;
  /** 보조 설명 텍스트 */
  detailText: string;
}

/**
 * 기념일 계산:
 * 등록한 기념일 당일을 1일째(한국식 기념일 계산: 오늘 - 기념일 + 1)로 계산합니다.
 */
export function calculateAnniversary(
  targetDateStr: string,
  referenceDate: Date = new Date()
): AnniversaryCalculation {
  const today = toLocalMidnight(referenceDate);
  const target = parseLocalDate(targetDateStr);
  const elapsedDays = Math.floor((today.getTime() - target.getTime()) / DAY_MS);

  if (elapsedDays >= 0) {
    const dayCount = elapsedDays + 1;
    return {
      dayCount,
      elapsedDays,
      isFuture: false,
      badgeText: `${dayCount.toLocaleString()}일째`,
      detailText:
        elapsedDays === 0
          ? '오늘이 기념일 당일입니다 🎉 (1일째)'
          : `기념일로부터 ${elapsedDays.toLocaleString()}일 지남 (당일 1일째 기준)`,
    };
  }

  const remainDays = Math.abs(elapsedDays);
  return {
    dayCount: elapsedDays,
    elapsedDays,
    isFuture: true,
    badgeText: `D-${remainDays.toLocaleString()}`,
    detailText: `기념일까지 ${remainDays.toLocaleString()}일 남음`,
  };
}

export interface ResolutionCalculation {
  /** 0 ~ 100 사이의 달성/진행 퍼센트 */
  percent: number;
  /** 전체 기간 일수 (완료일 - 시작일) */
  totalDays: number;
  /** 경과 일수 (오늘 - 시작일) */
  elapsedDays: number;
  /** 남은 일수 (완료일 - 오늘) */
  remainingDays: number;
  /** 상태 구분 */
  status: 'upcoming' | 'in_progress' | 'completed';
  /** 상태 배지 텍스트 */
  statusLabel: string;
  /** 하단 상세 설명 텍스트 */
  detailText: string;
}

/**
 * 결심 진행률(%) 계산:
 * 시작일자와 완료일자 대비 오늘 날짜가 몇 % 지났는지 계산합니다 (0% ~ 100%).
 */
export function calculateResolution(
  startDateStr: string,
  endDateStr: string,
  referenceDate: Date = new Date()
): ResolutionCalculation {
  const today = toLocalMidnight(referenceDate);
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);

  const totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  const remainingDays = Math.max(0, Math.floor((end.getTime() - today.getTime()) / DAY_MS));

  if (today.getTime() < start.getTime()) {
    const waitDays = Math.abs(elapsedDays);
    return {
      percent: 0,
      totalDays,
      elapsedDays: 0,
      remainingDays: totalDays,
      status: 'upcoming',
      statusLabel: '진행 예정',
      detailText: `시작일까지 ${waitDays.toLocaleString()}일 남음 (총 ${totalDays.toLocaleString()}일 과정)`,
    };
  }

  if (totalDays === 0) {
    return {
      percent: 100,
      totalDays: 1,
      elapsedDays: 1,
      remainingDays: 0,
      status: 'completed',
      statusLabel: '달성 완료',
      detailText: '당일 결심 목표 기간 도달 🎉',
    };
  }

  if (today.getTime() >= end.getTime()) {
    return {
      percent: 100,
      totalDays,
      elapsedDays: totalDays,
      remainingDays: 0,
      status: 'completed',
      statusLabel: '완료일 도달',
      detailText: `총 ${totalDays.toLocaleString()}일 결심 기간 완료 🎉`,
    };
  }

  const rawPercent = Math.round((elapsedDays / totalDays) * 100);
  const percent = Math.max(0, Math.min(100, rawPercent));

  return {
    percent,
    totalDays,
    elapsedDays,
    remainingDays,
    status: 'in_progress',
    statusLabel: '진행 중',
    detailText: `전체 ${totalDays.toLocaleString()}일 중 ${elapsedDays.toLocaleString()}일 경과 (${remainingDays.toLocaleString()}일 남음)`,
  };
}
