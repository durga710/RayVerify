import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RiskLevel, VerificationResult } from "./types";

// ---------------------------------------------------------------------------
// Tailwind class merging
// ---------------------------------------------------------------------------

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Risk band helpers
// ---------------------------------------------------------------------------

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score <= 30) return RiskLevel.LOW;
  if (score <= 60) return RiskLevel.MODERATE;
  if (score <= 80) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

export function riskLevelLabel(level: RiskLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Fraud event type label
// ---------------------------------------------------------------------------

const FRAUD_TYPE_LABELS: Record<string, string> = {
  IMPOSSIBLE_TRAVEL: "Impossible Travel",
  DUPLICATE_VISIT: "Duplicate Visit",
  SHARED_DEVICE: "Shared Device",
  GPS_ANOMALY: "GPS Anomaly",
  IDENTITY_MISMATCH: "Identity Mismatch",
  UNUSUAL_BILLING: "Unusual Billing",
  ABNORMAL_DURATION: "Abnormal Duration",
  EXCESSIVE_OVERTIME: "Excessive Overtime",
  SERVICE_OVERLAP: "Service Overlap",
  CROSS_PROVIDER_RISK: "Cross-Provider Risk",
  LIVENESS_FAILURE: "Liveness Failure",
  DEVICE_TAMPERING: "Device Tampering",
  GEOFENCE_BREACH: "Geofence Breach",
};

export function fraudTypeLabel(type: string): string {
  return FRAUD_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// Verification result label
// ---------------------------------------------------------------------------

export function verificationResultLabel(result: VerificationResult): string {
  return result.charAt(0) + result.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Case / visit status labels
// ---------------------------------------------------------------------------

export function caseStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function visitStatusLabel(status: string): string {
  return caseStatusLabel(status);
}

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
