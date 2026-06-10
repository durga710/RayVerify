import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, MapPin, Shield, User, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/RiskBadge";
import { FraudTimeline } from "@/components/FraudTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  MOCK_CASES,
  MOCK_FRAUD_EVENTS,
  MOCK_CASE_NOTES,
  MOCK_CASE_EVIDENCE,
} from "@/lib/mock";
import {
  formatCents,
  formatDateTime,
  caseStatusLabel,
} from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/risk";

export const metadata: Metadata = { title: "Case Detail" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const fraudCase = MOCK_CASES.find((c) => c.id === id);
  if (!fraudCase) notFound();

  const events = MOCK_FRAUD_EVENTS.filter((e) => e.caseId === id);
  const notes = MOCK_CASE_NOTES.filter((n) => n.caseId === id);
  const evidence = MOCK_CASE_EVIDENCE.filter((e) => e.caseId === id);
  const priorityCfg = PRIORITY_CONFIG[fraudCase.priority];

  const STATUS_TRANSITIONS: Record<string, string[]> = {
    OPEN: ["IN_REVIEW", "ESCALATED"],
    IN_REVIEW: ["ESCALATED", "PENDING_PAYMENT_HOLD", "UNSUBSTANTIATED"],
    ESCALATED: ["PENDING_PAYMENT_HOLD", "SUBSTANTIATED"],
    PENDING_PAYMENT_HOLD: ["SUBSTANTIATED", "UNSUBSTANTIATED"],
  };
  const availableTransitions = STATUS_TRANSITIONS[fraudCase.status] ?? [];

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link href="/cases">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Cases
          </Link>
        </Button>
        <PageHeader
          title={fraudCase.caseNumber}
          description={fraudCase.title}
          actions={
            availableTransitions.length > 0 ? (
              <div className="flex gap-2">
                {availableTransitions.map((t) => (
                  <Button key={t} variant="outline" size="sm">
                    {caseStatusLabel(t)}
                  </Button>
                ))}
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Metadata strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Status", value: caseStatusLabel(fraudCase.status) },
          {
            label: "Priority",
            value: (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${priorityCfg.badgeClass}`}
              >
                {priorityCfg.label}
              </span>
            ),
          },
          {
            label: "Risk",
            value: <RiskBadge level={fraudCase.riskLevel} />,
          },
          {
            label: "Exposure",
            value: fraudCase.exposureCents
              ? formatCents(fraudCase.exposureCents)
              : "—",
          },
          {
            label: "Assignee",
            value: fraudCase.assignee
              ? `${fraudCase.assignee.firstName} ${fraudCase.assignee.lastName}`
              : "Unassigned",
          },
          {
            label: "Opened",
            value: formatDateTime(fraudCase.openedAt),
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Provider */}
      {fraudCase.provider && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <span className="text-sm font-medium text-foreground">
              {fraudCase.provider.legalName}
            </span>
            <span className="ml-3 text-xs text-muted-foreground">
              NPI: {fraudCase.provider.npi ?? "—"} · Medicaid ID:{" "}
              {fraudCase.provider.medicaidId ?? "—"}
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild className="ml-auto">
            <Link href={`/providers`}>View Provider Profile</Link>
          </Button>
        </div>
      )}

      {/* Summary */}
      {fraudCase.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {fraudCase.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Timeline, Evidence, Notes */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            Fraud Events ({events.length})
          </TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence ({evidence.length})
          </TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="pt-5">
              <FraudTimeline events={events.length > 0 ? events : MOCK_FRAUD_EVENTS.slice(0, 3)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardContent className="pt-5">
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No evidence attached yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {evidence.map((ev) => (
                    <li key={ev.id} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ev.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kind: {ev.kind}
                          {ev.contentHash && (
                            <span className="ml-2 font-mono text-[10px]">
                              {ev.contentHash}
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-border pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        {note.author?.firstName} {note.author?.lastName}
                      </span>
                      {note.isInternal && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-semibold">
                          Internal
                        </span>
                      )}
                      <Clock className="h-3 w-3 text-muted-foreground ml-auto" />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {note.body}
                    </p>
                    <Separator className="mt-4" />
                  </div>
                ))
              )}

              {/* Add note form */}
              <div className="pt-2">
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  rows={3}
                  placeholder="Add an investigator note..."
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm">Add Note</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
