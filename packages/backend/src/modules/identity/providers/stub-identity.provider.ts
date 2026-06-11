import { Injectable } from '@nestjs/common';
import {
  IdentityCompareInput,
  IdentityCompareResult,
  IdentityProvider,
} from './identity-provider.interface';

/**
 * Deterministic local matcher for development/CI. Returns high scores by default
 * (happy path) but honors `simulate` overrides so flows like REVIEW/FAIL and the
 * fraud IDENTITY_MISMATCH detector can be exercised end-to-end without a vendor.
 *
 * Replace with a real provider in production — see IdentityProvider.
 */
@Injectable()
export class StubIdentityProvider extends IdentityProvider {
  readonly name = 'stub-matcher@1.0.0';

  async compare(input: IdentityCompareInput): Promise<IdentityCompareResult> {
    return {
      confidence: input.simulate?.confidence ?? 0.96,
      liveness: input.simulate?.liveness ?? 0.98,
      matcher: this.name,
    };
  }
}
