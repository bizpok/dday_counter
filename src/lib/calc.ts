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

/**
 * 특정 'YYYY-MM-DD' 날짜가 시작일~완료일 범위(양끝 포함) 안에 있는지 확인합니다.
 */
export function isDateInRange(
  dateStr: string,
  startDateStr: string,
  endDateStr: string
): boolean {
  const target = parseLocalDate(dateStr).getTime();
  const start = parseLocalDate(startDateStr).getTime();
  const end = parseLocalDate(endDateStr).getTime();
  return target >= start && target <= end;
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
          ? '오늘이 기념일 당일입니다 🎉'
          : `기념일로부터 ${elapsedDays.toLocaleString()}일 지남`,
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
  /** 0 ~ 100 사이의 성공율 퍼센트 */
  percent: number;
  /** 전체 기간 일수 (시작일~완료일 양끝 포함 일수) */
  totalDays: number;
  /** 경과 일수 (오늘 - 시작일) */
  elapsedDays: number;
  /** 남은 일수 (완료일 - 오늘) */
  remainingDays: number;
  /** 성공으로 체크한 일수 */
  successDays: number;
  /** 실패로 체크한 일수 */
  failDays: number;
  /** 체크 완료한 총 일수 (성공 + 실패) */
  checkedDays: number;
  /** 미체크 일수 */
  uncheckedDays: number;
  /** 상태 구분 */
  status: 'upcoming' | 'in_progress' | 'completed';
  /** 상태 배지 텍스트 */
  statusLabel: string;
  /** 하단 상세 설명 텍스트 */
  detailText: string;
}

/**
 * 결심 성공율(%) 및 기간 계산:
 * - checkLogs가 전달되면 기간 내 '성공(success)' / '실패(fail)' 체크 일수를 바탕으로 성공율(%)을 계산합니다.
 */
export function calculateResolution(
  startDateStr: string,
  endDateStr?: string | null,
  referenceDate: Date = new Date(),
  checkLogs?: Record<string, 'success' | 'fail'>
): ResolutionCalculation {
  const today = toLocalMidnight(referenceDate);
  const effectiveEndDateStr = endDateStr || formatDateInput(today);
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(effectiveEndDateStr);

  if (!endDateStr && today.getTime() < start.getTime()) {
    const waitDays = Math.ceil((start.getTime() - today.getTime()) / DAY_MS);
    return {
      percent: 0,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: waitDays,
      successDays: 0,
      failDays: 0,
      checkedDays: 0,
      uncheckedDays: 0,
      status: 'upcoming',
      statusLabel: '진행 예정',
      detailText: `시작일까지 ${waitDays.toLocaleString()}일 남음`,
    };
  }

  const diffDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
  const inclusivePeriodDays = diffDays + 1;
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  const remainingDays = Math.max(0, Math.floor((end.getTime() - today.getTime()) / DAY_MS));

  // checkLogs가 주어진 경우: 일별 성공/실패 체크 기록 기반 성공율 계산
  if (checkLogs !== undefined) {
    let successDays = 0;
    let failDays = 0;

    for (const [dateKey, status] of Object.entries(checkLogs)) {
      if (isDateInRange(dateKey, startDateStr, effectiveEndDateStr)) {
        if (status === 'success') successDays += 1;
        else if (status === 'fail') failDays += 1;
      }
    }

    const checkedDays = successDays + failDays;
    const uncheckedDays = Math.max(0, inclusivePeriodDays - checkedDays);
    const percent =
      inclusivePeriodDays > 0
        ? Math.min(100, Math.round((successDays / inclusivePeriodDays) * 100))
        : 0;

    const status: 'upcoming' | 'in_progress' | 'completed' =
      today.getTime() < start.getTime()
        ? 'upcoming'
        : endDateStr && (today.getTime() > end.getTime() || checkedDays >= inclusivePeriodDays)
        ? 'completed'
        : 'in_progress';

    const statusLabel =
      status === 'completed' ? '완료' : status === 'upcoming' ? '진행 예정' : '진행 중';

    const detailText =
      checkedDays === 0
        ? `진행 ${inclusivePeriodDays.toLocaleString()}일차 · '진행'을 눌러 성공/실패를 체크하세요`
        : `성공 ${successDays}일 · 실패 ${failDays}일 (진행 ${inclusivePeriodDays}일 중 ${checkedDays}일 체크)`;

    return {
      percent,
      totalDays: inclusivePeriodDays,
      elapsedDays: Math.max(0, elapsedDays),
      remainingDays,
      successDays,
      failDays,
      checkedDays,
      uncheckedDays,
      status,
      statusLabel,
      detailText,
    };
  }

  // 기본(레거시) 날짜 경과 기준 계산
  if (today.getTime() < start.getTime()) {
    const waitDays = Math.abs(elapsedDays);
    return {
      percent: 0,
      totalDays: diffDays,
      elapsedDays: 0,
      remainingDays: diffDays,
      successDays: 0,
      failDays: 0,
      checkedDays: 0,
      uncheckedDays: inclusivePeriodDays,
      status: 'upcoming',
      statusLabel: '진행 예정',
      detailText: `시작일까지 ${waitDays.toLocaleString()}일 남음 (총 ${diffDays.toLocaleString()}일 과정)`,
    };
  }

  if (diffDays === 0) {
    return {
      percent: 100,
      totalDays: 1,
      elapsedDays: 1,
      remainingDays: 0,
      successDays: 0,
      failDays: 0,
      checkedDays: 0,
      uncheckedDays: 1,
      status: 'completed',
      statusLabel: '달성 완료',
      detailText: '당일 결심 목표 기간 도달 🎉',
    };
  }

  if (today.getTime() >= end.getTime()) {
    return {
      percent: 100,
      totalDays: diffDays,
      elapsedDays: diffDays,
      remainingDays: 0,
      successDays: 0,
      failDays: 0,
      checkedDays: 0,
      uncheckedDays: inclusivePeriodDays,
      status: 'completed',
      statusLabel: '완료일 도달',
      detailText: `총 ${diffDays.toLocaleString()}일 결심 기간 완료 🎉`,
    };
  }

  const rawPercent = Math.round((elapsedDays / diffDays) * 100);
  const percent = Math.max(0, Math.min(100, rawPercent));

  return {
    percent,
    totalDays: diffDays,
    elapsedDays,
    remainingDays,
    successDays: 0,
    failDays: 0,
    checkedDays: 0,
    uncheckedDays: inclusivePeriodDays,
    status: 'in_progress',
    statusLabel: '진행 중',
    detailText: `전체 ${diffDays.toLocaleString()}일 중 ${elapsedDays.toLocaleString()}일 경과 (${remainingDays.toLocaleString()}일 남음)`,
  };
}
