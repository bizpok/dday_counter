import { describe, expect, it } from 'vitest';
import { calculateAnniversary, calculateResolution } from './calc';

describe('calculateAnniversary (당일 1일째 기준)', () => {
  it('기념일 당일이면 1일째로 표시한다', () => {
    const today = new Date(2026, 9, 25); // 2026-10-25
    const res = calculateAnniversary('2026-10-25', today);
    expect(res.dayCount).toBe(1);
    expect(res.elapsedDays).toBe(0);
    expect(res.badgeText).toBe('1일째');
    expect(res.isFuture).toBe(false);
  });

  it('기념일로부터 99일이 지났으면 100일째로 표시한다', () => {
    const today = new Date(2026, 9, 25); // 2026-10-25
    const res = calculateAnniversary('2026-07-18', today); // 99일 전
    expect(res.elapsedDays).toBe(99);
    expect(res.dayCount).toBe(100);
    expect(res.badgeText).toBe('100일째');
  });

  it('미래 기념일이면 D-N 형식으로 남은 일수를 표시한다', () => {
    const today = new Date(2026, 9, 25); // 2026-10-25
    const res = calculateAnniversary('2026-10-30', today);
    expect(res.isFuture).toBe(true);
    expect(res.badgeText).toBe('D-5');
  });
});

describe('calculateResolution (결심 진행률 % 계산)', () => {
  it('전체 100일 기간 중 50일이 경과하면 50%를 반환한다', () => {
    const today = new Date(2026, 9, 25); // 2026-10-25
    // 2026-10-05 ~ 2026-11-14 (40일 기간 중 20일 경과 = 50%)
    const res = calculateResolution('2026-10-05', '2026-11-14', today);
    expect(res.totalDays).toBe(40);
    expect(res.elapsedDays).toBe(20);
    expect(res.percent).toBe(50);
    expect(res.status).toBe('in_progress');
  });

  it('시작일 이전이면 0% 및 upcoming 상태를 반환한다', () => {
    const today = new Date(2026, 9, 25);
    const res = calculateResolution('2026-11-01', '2026-12-01', today);
    expect(res.percent).toBe(0);
    expect(res.status).toBe('upcoming');
  });

  it('완료일에 도달하거나 지났으면 100% 및 completed 상태를 반환한다', () => {
    const today = new Date(2026, 9, 25);
    const res = calculateResolution('2026-09-01', '2026-10-20', today);
    expect(res.percent).toBe(100);
    expect(res.status).toBe('completed');
  });
});
