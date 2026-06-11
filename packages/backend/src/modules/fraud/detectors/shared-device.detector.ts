import { FraudEventType } from '@prisma/client';
import { Detector, DetectionResult, VisitFeatureContext, notTriggered } from './types';

/**
 * SHARED_DEVICE / DEVICE_TAMPERING — one device used by an implausible number of
 * distinct caregivers (badge-sharing / buddy-punching ring), or a device with
 * tampering signals (emulator / rooted / jailbroken / BLOCKED trust).
 */
export class SharedDeviceDetector implements Detector {
  readonly type = FraudEventType.SHARED_DEVICE;
  readonly version = '1.0.0';

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { device, deviceCaregiverCount = 0 } = ctx;

    const tamper =
      device != null &&
      (device.isEmulator || device.isRooted || device.isJailbroken || device.trustLevel === 'BLOCKED');

    const sharedThreshold = 3; // >3 caregivers on one device is suspicious
    const shared = deviceCaregiverCount > sharedThreshold;

    if (!tamper && !shared) {
      return notTriggered(this.type, 'No shared-device or tampering signal');
    }

    let severity = 0;
    if (shared) severity += Math.min(60, 30 + (deviceCaregiverCount - sharedThreshold) * 10);
    if (tamper) severity += 50;
    severity = Math.min(100, severity);

    const reasons: string[] = [];
    if (shared) reasons.push(`${deviceCaregiverCount} distinct caregivers used this device`);
    if (device?.isEmulator) reasons.push('emulator detected');
    if (device?.isRooted) reasons.push('rooted device');
    if (device?.isJailbroken) reasons.push('jailbroken device');
    if (device?.trustLevel === 'BLOCKED') reasons.push('device trust level BLOCKED');

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation: `Device risk: ${reasons.join('; ')}.`,
      evidence: {
        deviceCaregiverCount,
        sharedThreshold,
        isEmulator: device?.isEmulator ?? false,
        isRooted: device?.isRooted ?? false,
        isJailbroken: device?.isJailbroken ?? false,
        trustLevel: device?.trustLevel ?? 'UNKNOWN',
      },
    };
  }
}
