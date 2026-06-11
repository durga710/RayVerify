import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { IDENTITY_PROVIDER } from './providers/identity-provider.interface';
import { StubIdentityProvider } from './providers/stub-identity.provider';

/**
 * The identity provider is bound here. Swap StubIdentityProvider for a vendor
 * (e.g. RekognitionIdentityProvider) or a hardware-backed provider without
 * changing IdentityService.
 */
@Module({
  controllers: [IdentityController],
  providers: [
    IdentityService,
    { provide: IDENTITY_PROVIDER, useClass: StubIdentityProvider },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
