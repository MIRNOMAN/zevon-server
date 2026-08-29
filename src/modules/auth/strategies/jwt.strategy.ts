import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Passport JWT strategy for validating Access Tokens.
 * Extracts the JWT from the Authorization Bearer header, validates signature and expiration,
 * and attaches the sanitized user object (with role) to req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret =
      configService.get<string>('jwt.accessSecret') ||
      configService.get<string>('JWT_ACCESS_SECRET') ||
      configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT Access Secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account has been deactivated');
    }

    return user;
  }
}
