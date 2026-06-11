import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { VisitsModule } from './modules/visits/visits.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { CasesModule } from './modules/cases/cases.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HardwareModule } from './modules/hardware/hardware.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    // Feature modules — one per RayVerify product module + supporting concerns.
    HealthModule,
    AuthModule,
    IdentityModule, // Module 1: Identity Verification Engine
    VisitsModule, // Module 2: Visit Verification Engine
    FraudModule, // Module 3: Fraud Intelligence Engine
    CasesModule, // Module 4: Investigator Dashboard (case mgmt API)
    ProvidersModule, // Module 5: Provider Risk Scoring
    AuditModule, // Module 6: Audit & Compliance Center
    ReportsModule, // Module 7: Reporting & Analytics
    NotificationsModule,
    HardwareModule, // Module 8: Future Hardware Integration Layer
  ],
  providers: [
    // Global authn/authz/rate-limit. @Public() opts routes out of auth.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
