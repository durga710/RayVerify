import { Injectable, Logger } from '@nestjs/common';
import { HardwareCapability, HardwareDriver } from './sdk/hardware.types';

/**
 * Central registry for hardware drivers. Future devices self-register their
 * driver here at boot; the engines resolve a capability (e.g. FACE, NFC) without
 * knowing the concrete device. Nothing is registered today — the platform runs
 * fully on software providers — but the seam exists so hardware drops in cleanly.
 */
@Injectable()
export class HardwareRegistryService {
  private readonly logger = new Logger(HardwareRegistryService.name);
  private readonly drivers = new Map<HardwareCapability, HardwareDriver>();

  register(driver: HardwareDriver): void {
    if (this.drivers.has(driver.capability)) {
      this.logger.warn(`Overriding existing driver for ${driver.capability}`);
    }
    this.drivers.set(driver.capability, driver);
    this.logger.log(`Registered hardware driver ${driver.id} (${driver.capability})`);
  }

  get<T extends HardwareDriver>(capability: HardwareCapability): T | undefined {
    return this.drivers.get(capability) as T | undefined;
  }

  has(capability: HardwareCapability): boolean {
    return this.drivers.has(capability);
  }

  /** Capabilities the SDK supports vs. what is actually registered/online. */
  async catalog() {
    const supported = Object.values(HardwareCapability);
    const registered = await Promise.all(
      [...this.drivers.values()].map(async (d) => ({
        capability: d.capability,
        driver: d.id,
        health: await d.health().catch(() => 'OFFLINE' as const),
      })),
    );
    return { supported, registered };
  }
}
