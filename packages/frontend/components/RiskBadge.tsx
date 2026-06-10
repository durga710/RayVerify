import { cn } from "@/lib/utils";
import { getRiskBand } from "@/lib/risk";
import { RiskLevel } from "@/lib/types";

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  className?: string;
  showScore?: boolean;
}

export function RiskBadge({
  level,
  score,
  className,
  showScore = false,
}: RiskBadgeProps) {
  const band = getRiskBand(level);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
        band.badgeClass,
        className
      )}
    >
      {band.label}
      {showScore && score !== undefined && (
        <span className="opacity-75">({score})</span>
      )}
    </span>
  );
}
