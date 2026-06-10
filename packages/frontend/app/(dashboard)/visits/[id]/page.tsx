import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Shield,
  Smartphone,
  User,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { VerificationResultBadge } from "@/components/VerificationResultBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MOCK_VISITS } from "@/lib/mock";
import {
  VerificationChainStep,
  VerificationResult,
} from "@/lib/types";
import {
  formatDateTime,
  formatDuration,
  formatCents,
  visitStatusLabel,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Visit Verification Chain" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const STEP_ICONS: Record<string, React.ElementType> = {
  identity: User,
  gps: MapPin,
  device: Smartphone,
  patient: Shield,
  fraud: Activity,
};

const STEP_RESULT_ICON: Record<VerificationResult, React.ElementType> = {
  [VerificationResult.PASS]: CheckCircle2,
  [VerificationResult.REVIEW]: AlertCircle,
  [VerificationResult.FAIL]: XCircle,
};

const STEP_RESULT_CLASS: Record<VerificationResult, string> = {
  [VerificationResult.PASS]: "text-green-600",
  [VerificationResult.REVIEW]: "text-amber-600",
  [VerificationResult.FAIL]: "text-red-600",
};

const STEP_BORDER_CLASS: Record<VerificationResult, string> = {
  [VerificationResult.PASS]: "border-green-200 bg-green-50",
  [VerificationResult.REVIEW]: "border-amber-200 bg-amber-50",
  [VerificationResult.FAIL]: "border-red-200 bg-red-50",
};

function VerificationStep({ step }: { step: VerificationChainStep }) {
  const StepIcon = STEP_ICONS[step.step] ?? Activity;
  const ResultIcon = STEP_RESULT_ICON[step.result];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        STEP_BORDER_CLASS[step.result]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-border shadow-sm">
            <StepIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{step.label}</p>
            {step.method && (
              <p className="text-xs text-muted-foreground">{step.method}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step.score !== undefined && (
            <span className="tabular-nums text-xs font-semibold text-foreground">
              {step.score}
            </span>
          )}
          <ResultIcon
            className={cn("h-5 w-5", STEP_RESULT_CLASS[step.result])}
          />
          <VerificationResultBadge result={step.result} />
        </div>
      </div>
      {step.details && (
        <p className="mt-2 text-xs text-muted-foreground ml-12 leading-relaxed">
          {step.details}
        </p>
      )}
    </div>
  );
}

export default async function VisitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const visit = MOCK_VISITS.find((v) => v.id === id);
  if (!visit) notFound();

  const chain = visit.visitVerification?.chain;
  const steps = chain
    ? [chain.identity, chain.gps, chain.device, chain.patient, chain.fraud].filter(
        Boolean
      )
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href="/visits">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Visits
          </Link>
        </Button>
        <PageHeader
          title={`Visit ${visit.id}`}
          description={`${visit.provider?.legalName ?? visit.providerId} · ${visitStatusLabel(visit.status)}`}
          actions={
            visit.verificationResult && visit.riskLevel ? (
              <div className="flex items-center gap-2">
                <VerificationResultBadge result={visit.verificationResult} />
                <RiskBadge level={visit.riskLevel} score={visit.riskScore} showScore />
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Scheduled Start", value: formatDateTime(visit.scheduledStart) },
          { label: "Clock-in", value: visit.clockInAt ? formatDateTime(visit.clockInAt) : "—" },
          { label: "Clock-out", value: visit.clockOutAt ? formatDateTime(visit.clockOutAt) : "—" },
          { label: "Duration", value: visit.durationMinutes && visit.durationMinutes > 0 ? formatDuration(visit.durationMinutes) : "—" },
          { label: "Service Code", value: visit.serviceCode ?? "—" },
          { label: "Billed Amount", value: visit.billedAmountCents != null ? formatCents(visit.billedAmountCents) : "—" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground truncate">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Verification Chain */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Visit Verification Chain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verification data available.
                </p>
              ) : (
                (steps as VerificationChainStep[]).map((step) => (
                  <VerificationStep key={step.step} step={step} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* GPS Map Placeholder + Evidence Hash */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Clock-in Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border bg-muted/50 h-44 flex items-center justify-center flex-col gap-2">
                <MapPin className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground text-center">
                  Interactive map
                  <br />
                  (requires Mapbox / Google Maps API key)
                </p>
              </div>
              {visit.clockInLat && visit.clockInLng && (
                <p className="mt-2 text-xs text-muted-foreground font-mono">
                  {visit.clockInLat.toFixed(6)}, {visit.clockInLng.toFixed(6)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Evidence Hash */}
          {visit.visitVerification?.evidenceHash && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tamper-Evident Hash</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] font-mono break-all text-muted-foreground bg-muted rounded p-2 leading-relaxed">
                  {visit.visitVerification.evidenceHash}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  SHA-256 over the canonical evidence package. Stored append-only.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Risk Score Breakdown */}
          {visit.riskLevel && visit.riskScore != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold tabular-nums text-foreground">
                    {visit.riskScore}
                  </span>
                  <RiskBadge level={visit.riskLevel} />
                </div>
                {/* Simple score bar */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${visit.riskScore}%`,
                      backgroundColor:
                        visit.riskScore > 80
                          ? "#dc2626"
                          : visit.riskScore > 60
                          ? "#ea580c"
                          : visit.riskScore > 30
                          ? "#d97706"
                          : "#16a34a",
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0 — LOW</span>
                  <span>100 — CRITICAL</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
