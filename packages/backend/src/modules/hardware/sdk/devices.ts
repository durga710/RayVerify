import {
  HardwareCapability,
  HardwareDriver,
  HardwareResult,
} from './hardware.types';

/**
 * Capability-specific driver contracts. Future hardware ships a class
 * implementing the matching interface and registers it with HardwareRegistry.
 */

export interface NfcReadResult {
  /** Credential identifier read from the card/tag. */
  uid: string;
  /** Government/credential payload (e.g. PIV/CAC, mobile DL). */
  credential?: Record<string, unknown>;
}
export interface NfcReader extends HardwareDriver {
  readonly capability: HardwareCapability.NFC;
  read(timeoutMs?: number): Promise<HardwareResult<NfcReadResult>>;
}

export interface FingerprintResult {
  /** Opaque, irreversible template reference (never the raw minutiae). */
  templateRef: string;
  matchScore?: number; // 0..1 if verifying against an enrollment
}
export interface FingerprintScanner extends HardwareDriver {
  readonly capability: HardwareCapability.FINGERPRINT;
  capture(): Promise<HardwareResult<FingerprintResult>>;
  verify(enrolledTemplateRef: string): Promise<HardwareResult<FingerprintResult>>;
}

export interface FaceCaptureResult {
  imageS3Key?: string;
  embeddingRef?: string;
  liveness?: number; // 0..1
  confidence?: number; // 0..1 vs enrolled
}
export interface FacialRecognitionCamera extends HardwareDriver {
  readonly capability: HardwareCapability.FACE;
  captureWithLiveness(): Promise<HardwareResult<FaceCaptureResult>>;
}

export interface AttestationResult {
  /** Signed attestation proving the capture ran on trusted hardware. */
  attestation: string;
  publicKeyRef: string;
}
export interface SecureElement extends HardwareDriver {
  readonly capability: HardwareCapability.SECURE_ELEMENT;
  sign(payload: string): Promise<HardwareResult<{ signature: string }>>;
  attest(nonce: string): Promise<HardwareResult<AttestationResult>>;
}

export interface GpsFixResult {
  lat: number;
  lng: number;
  accuracyMeters: number;
  /** True if the fix is hardware-asserted (harder to spoof than browser geo). */
  hardwareAsserted: boolean;
}
export interface GpsModule extends HardwareDriver {
  readonly capability: HardwareCapability.GPS;
  getFix(timeoutMs?: number): Promise<HardwareResult<GpsFixResult>>;
}

export interface LteIdentityResult {
  imei?: string;
  imsiRef?: string; // tokenized; never store raw IMSI
  carrier?: string;
}
export interface LteModem extends HardwareDriver {
  readonly capability: HardwareCapability.LTE;
  identity(): Promise<HardwareResult<LteIdentityResult>>;
}
