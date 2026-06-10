/* eslint-disable no-console */
/**
 * Seeds a demo tenant with full RBAC and enough domain data to exercise the
 * verification + fraud engines end-to-end.
 *
 * RLS note: business tables use FORCE ROW LEVEL SECURITY, so even the owner must
 * set `app.current_org`. We create the organization (no RLS) and the global
 * permission catalog first, then seed tenant rows inside a single transaction
 * with `SET LOCAL app.current_org` so every insert satisfies the policy.
 */
import { PrismaClient, VerificationResult, IdentityMethod } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: Array<[string, string]> = [
  ['identity:verify', 'Run identity verification'],
  ['visit:create', 'Create/schedule visits'],
  ['visit:read', 'Read visits & verification packages'],
  ['visit:clock', 'Record clock-in/out'],
  ['visit:verify', 'Run the verification chain'],
  ['fraud_event:read', 'Read fraud events'],
  ['fraud:score', 'Trigger fraud scoring'],
  ['fraud_case:create', 'Open cases'],
  ['fraud_case:read', 'Read cases'],
  ['fraud_case:assign', 'Assign cases'],
  ['fraud_case:update', 'Update cases / notes'],
  ['provider:read', 'Read providers & risk'],
  ['provider:score', 'Recompute provider risk'],
  ['audit:read', 'Read audit trail'],
  ['report:create', 'Request reports'],
  ['report:read', 'Read reports'],
];

async function main() {
  console.log('Seeding RayVerify demo tenant…');

  // 1) Organization (no RLS) + global permission catalog.
  const org = await prisma.organization.upsert({
    where: { slug: 'state-pi' },
    update: {},
    create: {
      name: 'State Program Integrity Unit (Demo)',
      slug: 'state-pi',
      jurisdiction: 'US-XX',
      settings: { fraud: { autoFlagScore: 61 } },
    },
  });

  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key, description } });
  }
  const allPerms = await prisma.permission.findMany();

  const adminHash = await argon2.hash('ChangeMe!Admin123');
  const invHash = await argon2.hash('ChangeMe!Invest123');

  // 2) Tenant rows inside an RLS-scoped transaction.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL "app.current_org" = '${org.id}'`);

    const adminRole = await tx.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: 'ORG_ADMIN' } },
      update: {},
      create: { organizationId: org.id, key: 'ORG_ADMIN', name: 'Organization Admin', isSystem: true },
    });
    const invRole = await tx.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: 'INVESTIGATOR' } },
      update: {},
      create: { organizationId: org.id, key: 'INVESTIGATOR', name: 'Fraud Investigator', isSystem: true },
    });

    // ORG_ADMIN → all permissions; INVESTIGATOR → read/investigate subset.
    const investigatorKeys = new Set([
      'visit:read', 'visit:verify', 'fraud_event:read', 'fraud:score',
      'fraud_case:create', 'fraud_case:read', 'fraud_case:assign', 'fraud_case:update',
      'provider:read', 'provider:score', 'audit:read', 'report:create', 'report:read',
    ]);
    for (const p of allPerms) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      });
      if (investigatorKeys.has(p.key)) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: invRole.id, permissionId: p.id } },
          update: {},
          create: { roleId: invRole.id, permissionId: p.id },
        });
      }
    }

    const admin = await tx.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: 'admin@state-pi.gov' } },
      update: {},
      create: {
        organizationId: org.id, email: 'admin@state-pi.gov', passwordHash: adminHash,
        firstName: 'Ada', lastName: 'Admin', status: 'ACTIVE',
      },
    });
    const investigator = await tx.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: 'investigator@state-pi.gov' } },
      update: {},
      create: {
        organizationId: org.id, email: 'investigator@state-pi.gov', passwordHash: invHash,
        firstName: 'Ivan', lastName: 'Investigator', status: 'ACTIVE',
      },
    });
    await tx.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
    await tx.userRole.upsert({ where: { userId_roleId: { userId: investigator.id, roleId: invRole.id } }, update: {}, create: { userId: investigator.id, roleId: invRole.id } });

    // Provider + caregiver (with enrollment) + patient + authorization + device.
    const provider = await tx.provider.create({
      data: { organizationId: org.id, legalName: 'Sunrise Home Care LLC', npi: '1234567893' },
    });
    const caregiver = await tx.caregiver.create({
      data: { organizationId: org.id, providerId: provider.id, firstName: 'Carla', lastName: 'Caregiver', email: 'carla@sunrise.example' },
    });
    await tx.biometricEnrollment.create({
      data: { caregiverId: caregiver.id, method: IdentityMethod.SELFIE, referenceS3Key: 'enroll/carla.jpg' },
    });
    const patient = await tx.patient.create({
      data: { organizationId: org.id, firstName: 'Pat', lastName: 'Patient' },
    });
    const auth = await tx.serviceAuthorization.create({
      data: {
        organizationId: org.id, patientId: patient.id, serviceCode: 'T1019',
        addressLine1: '100 Main St', city: 'Springfield', state: 'XX', postalCode: '00000',
        latitude: 39.781721, longitude: -89.650148, radiusMeters: 150,
        startDate: new Date('2026-01-01'),
      },
    });
    const device = await tx.device.create({
      data: { organizationId: org.id, deviceId: 'demo-device-001', platform: 'ANDROID', trustLevel: 'TRUSTED' },
    });

    // A clean PASS visit and a GPS-anomaly visit (far from the address).
    const cleanVisit = await tx.visit.create({
      data: {
        organizationId: org.id, providerId: provider.id, caregiverId: caregiver.id, patientId: patient.id,
        authorizationId: auth.id, deviceId: device.id, serviceCode: 'T1019', status: 'COMPLETED',
        scheduledStart: new Date('2026-06-09T14:00:00Z'),
        clockInAt: new Date('2026-06-09T14:02:00Z'), clockOutAt: new Date('2026-06-09T15:00:00Z'),
        durationMinutes: 58, clockInLat: 39.781730, clockInLng: -89.650100, billedUnits: 4,
      },
    });
    await tx.identityVerification.create({
      data: { organizationId: org.id, visitId: cleanVisit.id, caregiverId: caregiver.id, method: IdentityMethod.SELFIE, result: VerificationResult.PASS, confidenceScore: 0.97, livenessScore: 0.99 },
    });
    await tx.gpsVerification.create({
      data: { organizationId: org.id, visitId: cleanVisit.id, latitude: 39.781730, longitude: -89.650100, distanceMeters: 6, result: VerificationResult.PASS, capturedAt: new Date('2026-06-09T14:02:00Z') },
    });

    const anomalyVisit = await tx.visit.create({
      data: {
        organizationId: org.id, providerId: provider.id, caregiverId: caregiver.id, patientId: patient.id,
        authorizationId: auth.id, deviceId: device.id, serviceCode: 'T1019', status: 'COMPLETED',
        scheduledStart: new Date('2026-06-09T16:00:00Z'),
        clockInAt: new Date('2026-06-09T16:05:00Z'), clockOutAt: new Date('2026-06-09T16:06:30Z'),
        durationMinutes: 1, clockInLat: 39.900000, clockInLng: -89.900000, billedUnits: 4,
      },
    });
    await tx.identityVerification.create({
      data: { organizationId: org.id, visitId: anomalyVisit.id, caregiverId: caregiver.id, method: IdentityMethod.SELFIE, result: VerificationResult.REVIEW, confidenceScore: 0.71, livenessScore: 0.86 },
    });
    await tx.gpsVerification.create({
      data: { organizationId: org.id, visitId: anomalyVisit.id, latitude: 39.900000, longitude: -89.900000, distanceMeters: 28000, result: VerificationResult.FAIL, capturedAt: new Date('2026-06-09T16:05:00Z') },
    });

    console.log(`Seeded org=${org.slug} provider=${provider.legalName}`);
    console.log(`  visits: clean=${cleanVisit.id} anomaly=${anomalyVisit.id}`);
  });

  console.log('Done. Logins (org slug "state-pi"):');
  console.log('  admin@state-pi.gov / ChangeMe!Admin123');
  console.log('  investigator@state-pi.gov / ChangeMe!Invest123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
