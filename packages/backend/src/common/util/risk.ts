import { RiskLevel } from '@prisma/client';

/**
 * Canonical risk banding used across the platform (mirrored in the frontend).
 *   0–30 LOW · 31–60 MODERATE · 61–80 HIGH · 81–100 CRITICAL
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  const s = clampScore(score);
  if (s <= 30) return RiskLevel.LOW;
  if (s <= 60) return RiskLevel.MODERATE;
  if (s <= 80) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
