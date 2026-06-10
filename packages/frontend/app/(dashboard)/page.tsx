import type { Metadata } from "next";
import {
  AlertTriangle,
  FolderOpen,
  DollarSign,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/DataTable";
import {
  MOCK_OVERVIEW_STATS,
  MOCK_FRAUD_TREND,
  MOCK_RISK_DISTRIBUTION,
  MOCK_FRAUD_EVENTS,
} from "@/lib/mock";
import {
  formatCents,
  formatPercent,
  fraudTypeLabel,
  formatRelative,
} from "@/lib/utils";
import { RISK_BAND } from "@/lib/risk";
import { FraudEvent, RiskLevel } from "@/lib/types";
import { FraudTrendChart } from "./FraudTrendChart";
import { RiskDistributionChart } from "./RiskDistributionChart";

export const metadata: Metadata = { title: "Overview" };

const recentAlertColumns: Column<FraudEvent>[] = [
  {
    key: "type",
    header: "Alert Type",
    render: (row) => (
      <span className="font-medium text-foreground">{fraudTypeLabel(row.type)}</span>
    ),
  },
  {
    key: "risk",
    header: "Risk",
    render: (row) => <RiskBadge level={row.riskLevel} score={row.severity} showScore />,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.status.replace(/_/g, " ")}
      </span>
    ),
  },
  {
    key: "detected",
    header: "Detected",
    render: (row) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(row.detectedAt)}
      </span>
    ),
  },
];

export default function OverviewPage() {
  const stats = MOCK_OVERVIEW_STATS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Maryland Medicaid OIG — real-time fraud intelligence summary"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          title="Open Cases"
          value={String(stats.openCases)}
          change={stats.openCasesChange}
          icon={FolderOpen}
        />
        <StatCard
          title="Critical Alerts"
          value={String(stats.criticalAlerts)}
          change={stats.criticalAlertsChange}
          icon={AlertTriangle}
          iconClass="bg-red-50 [&>svg]:text-red-600"
        />
        <StatCard
          title="$ At Risk"
          value={formatCents(stats.dollarAtRiskCents)}
          subtitle="estimated exposure"
          icon={DollarSign}
          iconClass="bg-orange-50 [&>svg]:text-orange-600"
        />
        <StatCard
          title="Visits Verified Today"
          value={stats.visitsVerifiedToday.toLocaleString()}
          change={stats.visitsVerifiedChange}
          icon={CheckCircle2}
          iconClass="bg-green-50 [&>svg]:text-green-600"
        />
        <StatCard
          title="False-Positive Rate"
          value={formatPercent(stats.falsePositiveRate)}
          subtitle="rolling 30 days"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Fraud Alert Trend — Last 13 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <FraudTrendChart data={MOCK_FRAUD_TREND} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Risk Distribution (Visits)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskDistributionChart data={MOCK_RISK_DISTRIBUTION} />
            {/* Legend */}
            <div className="mt-4 space-y-1.5">
              {MOCK_RISK_DISTRIBUTION.map((d) => {
                const band = RISK_BAND[d.level as RiskLevel];
                return (
                  <div
                    key={d.level}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: band.hex }}
                      />
                      <span className="text-muted-foreground">{band.label}</span>
                    </div>
                    <span className="font-medium tabular-nums text-foreground">
                      {d.count.toLocaleString()}{" "}
                      <span className="text-muted-foreground">
                        ({formatPercent(d.pct)})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Recent Fraud Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            columns={recentAlertColumns}
            data={MOCK_FRAUD_EVENTS.slice(0, 6)}
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
