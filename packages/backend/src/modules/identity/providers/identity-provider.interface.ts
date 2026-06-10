/**
 * Abstraction over the biometric matcher (selfie face-match + liveness). Lets us
 * swap the stub for a vendor (AWS Rekognition, a NIST-tested SDK) or, later, the
 * hardware face/fingerprint modules — without touching the verification flow.
 */
export interface IdentityCompareInput {
  /** S3 key of the just-captured probe image. */
  probeS3Key?: string;
  /** Enrolled reference image / template pointers. */
  referenceS3Key?: string | null;
  templateRef?: string | null;
  /** Optional dev override to force scores in tests/demos. */
  simulate?: { confidence?: number; liveness?: number };
}

export interface IdentityCompareResult {
  /** 0..1 face-match confidence. */
  confidence: number;
  /** 0..1 liveness (anti-spoofing) probability. */
  liveness: number;
  /** Matcher identifier + version for reproducibility/audit. */
  matcher: string;
}

export abstract class IdentityProvider {
  abstract readonly name: string;
  abstract compare(input: IdentityCompareInput): Promise<IdentityCompareResult>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
