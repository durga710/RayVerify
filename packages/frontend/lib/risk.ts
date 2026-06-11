import { RiskLevel, VerificationResult } from "./types";

// ---------------------------------------------------------------------------
// Risk level → display properties
// ---------------------------------------------------------------------------

export interface RiskBandConfig {
  level: RiskLevel;
  label: string;
  /** Tailwind bg/text class pair for badge */
  badgeClass: string;
  /** Tailwind text colour for charts / accents */
  textClass: string;
  /** Hex for recharts fills */
  hex: string;
  /** Score range label */
  range: string;
}

export const RISK_BAND: Record<RiskLevel, RiskBandConfig> = {
  [RiskLevel.LOW]: {
    level: RiskLevel.LOW,
    label: "Low",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    textClass: "text-green-700",
    hex: "#16a34a",
    range: "0–30",
  },
  [RiskLevel.MODERATE]: {
    level: RiskLevel.MODERATE,
    label: "Moderate",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    textClass: "text-amber-700",
    hex: "#d97706",
    range: "31–60",
  },
  [RiskLevel.HIGH]: {
    level: RiskLevel.HIGH,
    label: "High",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    textClass: "text-orange-700",
    hex: "#ea580c",
    range: "61–80",
  },
  [RiskLevel.CRITICAL]: {
    level: RiskLevel.CRITICAL,
    label: "Critical",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    textClass: "text-red-700",
    hex: "#dc2626",
    range: "81–100",
  },
};

export function getRiskBand(level: RiskLevel): RiskBandConfig {
  return RISK_BAND[level];
}

export function scoreToRiskBand(score: number): RiskBandConfig {
  if (score <= 30) return RISK_BAND[RiskLevel.LOW];
  if (score <= 60) return RISK_BAND[RiskLevel.MODERATE];
  if (score <= 80) return RISK_BAND[RiskLevel.HIGH];
  return RISK_BAND[RiskLevel.CRITICAL];
}

// ---------------------------------------------------------------------------
// Verification result → display properties
// ---------------------------------------------------------------------------

export interface VerifyConfig {
  result: VerificationResult;
  label: string;
  badgeClass: string;
  textClass: string;
  hex: string;
}

export const VERIFY_CONFIG: Record<VerificationResult, VerifyConfig> = {
  [VerificationResult.PASS]: {
    result: VerificationResult.PASS,
    label: "Pass",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    textClass: "text-green-700",
    hex: "#16a34a",
  },
  [VerificationResult.REVIEW]: {
    result: VerificationResult.REVIEW,
    label: "Review",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    textClass: "text-amber-700",
    hex: "#d97706",
  },
  [VerificationResult.FAIL]: {
    result: VerificationResult.FAIL,
    label: "Fail",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    textClass: "text-red-700",
    hex: "#dc2626",
  },
};

export function getVerifyConfig(result: VerificationResult): VerifyConfig {
  return VERIFY_CONFIG[result];
}

// ---------------------------------------------------------------------------
// Case priority → display
// ---------------------------------------------------------------------------

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  LOW: { label: "Low", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
  MEDIUM: { label: "Medium", badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
  HIGH: { label: "High", badgeClass: "bg-orange-100 text-orange-800 border-orange-200" },
  URGENT: { label: "Urgent", badgeClass: "bg-red-100 text-red-800 border-red-200" },
};
