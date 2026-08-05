import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { type AuthenticatedUser, type JwtPayload } from '@/common/types';
import { type AppConfig } from '@/config';
import { PrismaService } from '@/core/prisma/prisma.service';

/**
 * Validates the access token and materialises `request.user`.
 *
 * Roles and permissions are re-read from the database on every request rather
 * than trusted from the token, so a revoked role takes effect immediately
 * instead of at token expiry. If that read becomes a bottleneck, cache it —
 * do not move the decision back into the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        schoolId: true,
        passwordChangedAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                systemKey: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    // Tokens minted before the last password change are dead, even if they have
    // not expired — otherwise "change my password" would not end a hijacked
    // session, which is the main reason people change it.
    if (user.passwordChangedAt && payload.iat) {
      const issuedAt = payload.iat * 1000;
      // `iat` has one-second resolution, so a token minted in the same second
      // as the change would otherwise be rejected on a rounding artefact.
      if (issuedAt < user.passwordChangedAt.getTime() - 1000) {
        throw new UnauthorizedException('Password was changed. Please sign in again.');
      }
    }

    return {
      id: user.id,
      email: user.email,
      schoolId: user.schoolId,
      roleNames: user.roles.map(({ role }) => role.name),
      systemKeys: user.roles.flatMap(({ role }) => (role.systemKey ? [role.systemKey] : [])),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
    };
  }
}
