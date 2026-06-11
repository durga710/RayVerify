import { cn } from "@/lib/utils";
import { getVerifyConfig } from "@/lib/risk";
import { VerificationResult } from "@/lib/types";

interface VerificationResultBadgeProps {
  result: VerificationResult;
  className?: string;
}

export function VerificationResultBadge({
  result,
  className,
}: VerificationResultBadgeProps) {
  const cfg = getVerifyConfig(result);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        cfg.badgeClass,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
