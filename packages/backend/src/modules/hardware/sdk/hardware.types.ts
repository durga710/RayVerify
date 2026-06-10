/**
 * RayVerify Hardware SDK — common types.
 *
 * The platform talks to all future hardware through these abstractions, so a new
 * device only needs a driver implementing the relevant interface — no changes to
 * the identity/visit/fraud engines. Each capability maps to an IdentityMethod or
 * an evidence source already modeled in the schema.
 */

export enum HardwareCapability {
  NFC = 'NFC', // smart-card / credential tap
  FINGERPRINT = 'FINGERPRINT', // fingerprint biometrics
  FACE = 'FACE', // facial-recognition camera
  SECURE_ELEMENT = 'SECURE_ELEMENT', // hardware-backed key store / attestation
  GPS = 'GPS', // dedicated GNSS module
  LTE = 'LTE', // cellular connectivity / SIM identity
}

export interface HardwareDeviceInfo {
  /** Stable hardware id / serial. */
  serial: string;
  vendor: string;
  model: string;
  firmwareVersion?: string;
  capabilities: HardwareCapability[];
}

export type HealthState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export interface HardwareResult<T> {
  ok: boolean;
  capability: HardwareCapability;
  /** Driver id + version for audit/reproducibility. */
  driver: string;
  data?: T;
  error?: string;
  capturedAt: string; // ISO-8601
}

/** Lifecycle every driver implements. */
export interface HardwareDriver {
  readonly id: string; // e.g. "acme-nfc@1.2.0"
  readonly capability: HardwareCapability;
  info(): Promise<HardwareDeviceInfo>;
  health(): Promise<HealthState>;
  /** Initialize/attach to the physical device. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
