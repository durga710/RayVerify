import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { DataTable, Column } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_RISK_PROFILES } from "@/lib/mock";
import { ProviderRiskProfile } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ProviderTrendSparkline } from "./ProviderTrendSparkline";
import { ProviderRiskTrendChart } from "./ProviderRiskTrendChart";

export const metadata: Metadata = { title: "Providers" };

const columns: Column<ProviderRiskProfile>[] = [
  {
    key: "rank",
    header: "#",
    render: (_row) => (
      <span className="tabular-nums text-xs text-muted-foreground">—</span>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    render: (row) => (
      <div>
        <p className="font-medium text-foreground text-sm">
          {row.provider?.legalName ?? row.providerId}
        </p>
        <p className="text-xs text-muted-foreground">
          NPI: {row.provider?.npi ?? "—"} · {row.provider?.medicaidId ?? "—"}
        </p>
      </div>
    ),
  },
  {
    key: "score",
    header: "Risk Score",
    render: (row) => (
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-lg font-bold text-foreground w-8">
          {row.currentScore}
        </span>
        <RiskBadge level={row.riskLevel} />
      </div>
    ),
  },
  {
    key: "trend",
    header: "30-day Trend",
    render: (row) => <ProviderTrendSparkline trend={row.trend} riskLevel={row.riskLevel} />,
  },
  {
    key: "failures",
    header: "Verify Failures",
    render: (row) => (
      <span className="tabular-nums text-sm font-medium text-foreground">
        {row.verificationFailures}
      </span>
    ),
  },
  {
    key: "gps",
    header: "GPS Anomalies",
    render: (row) => (
      <span className="tabular-nums text-sm text-foreground">
        {row.gpsAnomalies}
      </span>
    ),
  },
  {
    key: "billing",
    header: "Billing Flags",
    render: (row) => (
      <span className="tabular-nums text-sm text-foreground">
        {row.billingAnomalies}
      </span>
    ),
  },
  {
    key: "openCases",
    header: "Open Cases",
    render: (row) => (
      <span
        className={`tabular-nums text-sm font-semibold ${row.openCases > 0 ? "text-red-600" : "text-muted-foreground"}`}
      >
        {row.openCases}
      </span>
    ),
  },
  {
    key: "lastComputed",
    header: "Last Computed",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.lastComputedAt)}
      </span>
    ),
  },
];

export default function ProvidersPage() {
  const sorted = [...MOCK_RISK_PROFILES].sort(
    (a, b) => b.currentScore - a.currentScore
  );

  const criticalCount = sorted.filter((r) => r.riskLevel === "CRITICAL").length;
  const highCount = sorted.filter((r) => r.riskLevel === "HIGH").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Provider Risk Rankings"
        description="Dynamic risk scores updated continuously by the Fraud Intelligence Engine. Higher = more risk."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Tracked Providers", value: sorted.length, cls: "text-foreground" },
          { label: "Critical Risk", value: criticalCount, cls: "text-red-700" },
          { label: "High Risk", value: highCount, cls: "text-orange-700" },
          {
            label: "Avg Risk Score",
            value: Math.round(sorted.reduce((s, r) => s + r.currentScore, 0) / sorted.length),
            cls: "text-foreground",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={sorted}
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>

      {/* Detailed profile for top-risk provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Detailed Profile — {sorted[0].provider?.legalName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderDetailChart profile={sorted[0]} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider detail chart (inline server component — uses client chart child)
// ---------------------------------------------------------------------------

function ProviderDetailChart({ profile }: { profile: ProviderRiskProfile }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Historical Risk Score Trend
        </p>
        <ProviderRiskTrendChart trend={profile.trend} riskLevel={profile.riskLevel} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Risk Factors
        </p>
        {[
          { label: "Verification Failures", value: profile.verificationFailures },
          { label: "GPS Anomalies", value: profile.gpsAnomalies },
          { label: "Identity Issues", value: profile.identityIssues },
          { label: "Billing Anomalies", value: profile.billingAnomalies },
          { label: "Open Cases", value: profile.openCases },
          { label: "Substantiated Cases", value: profile.substantiatedCases },
        ].map((f) => (
          <div key={f.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{f.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
