import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { RegisterDto, RegisterAdminDto, LoginDto } from './dto/index.js';
import { BCRYPT_SALT_ROUNDS } from '../../common/constants/index.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;
  private readonly adminSecretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('jwt.accessSecret') ||
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'access-secret-default-123';

    this.accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') ||
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ||
      '15m';

    this.refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'refresh-secret-default-123';

    this.refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ||
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
      '7d';

    this.adminSecretKey =
      this.configService.get<string>('jwt.adminSecretKey') ||
      this.configService.get<string>('ADMIN_SECRET_KEY') ||
      'zevon-admin-secret-2026';
  }

  /**
   * Register a new Customer.
   * Hashes password, assigns CUSTOMER role, stores hashed refresh token in DB.
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        name: registerDto.name,
        password: hashedPassword,
        phone: registerDto.phone,
        role: Role.CUSTOMER,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateHashedRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Register an Admin or Manager account with secret master key authorization.
   */
  async registerAdmin(
    registerAdminDto: RegisterAdminDto,
  ): Promise<AuthResponse> {
    if (registerAdminDto.adminSecretKey !== this.adminSecretKey) {
      throw new UnauthorizedException(
        'Invalid Admin Secret Key. Unauthorized to register administrative roles.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: registerAdminDto.email },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(
      registerAdminDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email: registerAdminDto.email,
        name: registerAdminDto.name,
        password: hashedPassword,
        phone: registerAdminDto.phone,
        role: registerAdminDto.role,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateHashedRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Authenticate user with email and password.
   * Generates new JWT pair and updates DB with hashed refresh token.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateHashedRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Refresh Token Rotation.
   * Validates the refresh token against the hashed token in DB, then rotates both tokens.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; email: string; role: Role };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException(
        'Access Denied: Session revoked or expired',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account has been deactivated');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenValid) {
      // Possible token reuse attempt detected -> revoke all sessions
      await this.prisma.user.update({
        where: { id: user.id },
        data: { hashedRefreshToken: null },
      });
      throw new UnauthorizedException(
        'Access Denied: Security violation detected, token invalidated',
      );
    }

    // Token Rotation: Issue new Access & Refresh tokens
    const newTokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateHashedRefreshToken(user.id, newTokens.refreshToken);

    return newTokens;
  }

  /**
   * Revoke session on logout by clearing the hashed refresh token.
   */
  async logout(userId: string): Promise<{ revoked: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });

    return { revoked: true };
  }

  /**
   * Get authenticated user profile.
   */
  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  // ── Helper Methods ──────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    role: Role,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as unknown as number,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateHashedRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: hashed },
    });
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: Role;
    avatarUrl: string | null;
    createdAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
