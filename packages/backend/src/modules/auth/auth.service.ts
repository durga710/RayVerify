import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/context/tenant-context';
import { LoginDto, TokenResponseDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Resolves tenant from org slug (organizations is not RLS-protected), then
   * looks up the user inside that tenant's RLS scope. Uniform failures avoid
   * user-enumeration. Enforces lockout and MFA.
   */
  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (!org || !org.isActive) throw new UnauthorizedException('Invalid credentials');

    // Await INSIDE the run() scope: Prisma promises are lazy, and the RLS
    // extension reads the tenant from AsyncLocalStorage at execution time.
    const user = await TenantContext.run({ organizationId: org.id }, async () =>
      this.prisma.forRequest().user.findUnique({
        where: { organizationId_email: { organizationId: org.id, email: dto.email } },
        include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
      }),
    );

    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) {
      await this.registerFailure(org.id, user.id, user.failedLogins);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.mfaMethod !== 'NONE') {
      if (!dto.mfaCode || !user.mfaSecret) throw new UnauthorizedException('MFA code required');
      // NOTE: mfaSecret is KMS-encrypted at rest; decrypt before verify in prod.
      const valid = authenticator.verify({ token: dto.mfaCode, secret: user.mfaSecret });
      if (!valid) throw new UnauthorizedException('Invalid MFA code');
    }

    const roles = user.userRoles.map((ur) => ur.role.key);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    );

    await this.recordLogin(org.id, user.id);
    return this.issueTokens({
      sub: user.id,
      org: org.id,
      email: user.email,
      roles,
      permissions,
    });
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Rotate: revoke old session, issue new pair.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const u = session.user;
    const roles = u.userRoles.map((ur) => ur.role.key);
    const permissions = Array.from(
      new Set(u.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.key))),
    );
    return this.issueTokens({
      sub: u.id,
      org: u.organizationId,
      email: u.email,
      roles,
      permissions,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.session
      .updateMany({ where: { refreshTokenHash: tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  private async issueTokens(payload: JwtPayload): Promise<TokenResponseDto> {
    const accessTtl = this.config.get<number>('jwt.accessTtl')!;
    const refreshTtl = this.config.get<number>('jwt.refreshTtl')!;
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });
    const refreshToken = randomUUID() + '.' + randomUUID();
    await this.prisma.session.create({
      data: {
        userId: payload.sub,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: accessTtl, tokenType: 'Bearer' };
  }

  private async registerFailure(orgId: string, userId: string, failed: number): Promise<void> {
    const next = failed + 1;
    const lock = next >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
    await TenantContext.run({ organizationId: orgId }, async () =>
      this.prisma.forRequest().user.update({
        where: { id: userId },
        data: { failedLogins: next, lockedUntil: lock },
      }),
    );
  }

  private async recordLogin(orgId: string, userId: string): Promise<void> {
    await TenantContext.run({ organizationId: orgId }, async () =>
      this.prisma.forRequest().user.update({
        where: { id: userId },
        data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
    );
  }
}
