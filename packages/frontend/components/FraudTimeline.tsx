import React from "react";
import { FraudEvent } from "@/lib/types";
import { RiskBadge } from "@/components/RiskBadge";
import { fraudTypeLabel, formatDateTime } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FraudTimelineProps {
  events: FraudEvent[];
  className?: string;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  OPEN: Clock,
  TRIAGED: AlertTriangle,
  LINKED_TO_CASE: AlertTriangle,
  DISMISSED: CheckCircle2,
  CONFIRMED: XCircle,
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "text-amber-600 bg-amber-50 border-amber-200",
  TRIAGED: "text-blue-600 bg-blue-50 border-blue-200",
  LINKED_TO_CASE: "text-purple-600 bg-purple-50 border-purple-200",
  DISMISSED: "text-slate-500 bg-slate-50 border-slate-200",
  CONFIRMED: "text-red-600 bg-red-50 border-red-200",
};

export function FraudTimeline({ events, className }: FraudTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No fraud events linked to this record.
      </p>
    );
  }

  return (
    <ol className={cn("relative border-l border-border ml-3", className)}>
      {events.map((event, idx) => {
        const Icon = STATUS_ICON[event.status] ?? Clock;
        return (
          <li key={event.id} className={cn("ml-6 pb-6", idx === events.length - 1 && "pb-0")}>
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </span>
            <div className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {fraudTypeLabel(event.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.detectedAt)}
                    {event.detector && (
                      <span className="ml-2 font-mono">
                        [{event.detector}]
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={event.riskLevel} score={event.severity} showScore />
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-semibold",
                      STATUS_CLASS[event.status]
                    )}
                  >
                    {event.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              {event.explanation && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {event.explanation}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
