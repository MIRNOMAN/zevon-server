import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  RegisterDto,
  RegisterAdminDto,
  LoginDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/index.js';
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

interface PendingRegistration {
  dto: RegisterDto;
  otp: string;
  expiresAt: number;
}

interface PendingResetPassword {
  email: string;
  otp: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;
  private readonly adminSecretKey: string;

  // In-memory OTP store (10 minutes TTL)
  private readonly pendingRegistrations = new Map<string, PendingRegistration>();
  private readonly pendingResets = new Map<string, PendingResetPassword>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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

  // ────────────────────────────────────────────────────────────
  // Registration Flow (with Email OTP)
  // ────────────────────────────────────────────────────────────

  /**
   * Step 1: Initiate Customer Registration and dispatch 6-digit OTP to email.
   */
  async register(registerDto: RegisterDto): Promise<{
    success: boolean;
    message: string;
    email: string;
  }> {
    const email = registerDto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.pendingRegistrations.set(email, {
      dto: { ...registerDto, email },
      otp,
      expiresAt,
    });

    // Send email
    await this.mailService.sendRegistrationOtpEmail(
      email,
      otp,
      registerDto.name,
    );

    return {
      success: true,
      message: `Verification code sent to ${email}. Please check your inbox.`,
      email,
    };
  }

  /**
   * Step 2: Verify Registration OTP and create user in database.
   */
  async verifyRegisterOtp(verifyOtpDto: VerifyOtpDto): Promise<{
    user: UserResponse;
    message: string;
  }> {
    const email = verifyOtpDto.email.toLowerCase().trim();
    const pending = this.pendingRegistrations.get(email);

    if (!pending) {
      throw new BadRequestException(
        'No pending registration found or verification code has expired. Please register again.',
      );
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingRegistrations.delete(email);
      throw new BadRequestException(
        'Verification code has expired. Please request a new code.',
      );
    }

    if (pending.otp !== verifyOtpDto.otp.trim()) {
      throw new BadRequestException(
        'Invalid verification code. Please check your email and try again.',
      );
    }

    // Check once more in DB
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      this.pendingRegistrations.delete(email);
      throw new ConflictException('An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(
      pending.dto.password,
      BCRYPT_SALT_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email,
        name: pending.dto.name.trim(),
        password: hashedPassword,
        phone: pending.dto.phone?.trim() || null,
        role: Role.CUSTOMER,
      },
    });

    this.pendingRegistrations.delete(email);

    return {
      user: this.sanitizeUser(user),
      message: 'Account verified and registered successfully! You can now log in.',
    };
  }

  /**
   * Resend registration verification OTP.
   */
  async resendRegisterOtp(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const pending = this.pendingRegistrations.get(normalizedEmail);

    if (!pending) {
      throw new BadRequestException(
        'No pending registration found for this email. Please register again.',
      );
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otp = newOtp;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;

    await this.mailService.sendRegistrationOtpEmail(
      normalizedEmail,
      newOtp,
      pending.dto.name,
    );

    return {
      success: true,
      message: `A new verification code has been sent to ${normalizedEmail}.`,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Forgot Password Flow (with Email OTP)
  // ────────────────────────────────────────────────────────────

  /**
   * Step 1: Send Password Reset OTP.
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{
    success: boolean;
    message: string;
    email: string;
  }> {
    const email = forgotPasswordDto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(
        'No account found with this email address.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'This account has been deactivated. Please contact support.',
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    this.pendingResets.set(email, {
      email,
      otp,
      expiresAt,
    });

    await this.mailService.sendPasswordResetOtpEmail(user.email, otp, user.name);

    return {
      success: true,
      message: `Password reset code sent to ${email}.`,
      email,
    };
  }

  /**
   * Step 2: Validate Reset OTP before allowing password change.
   */
  async verifyResetOtp(verifyOtpDto: VerifyOtpDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const email = verifyOtpDto.email.toLowerCase().trim();
    const pending = this.pendingResets.get(email);

    if (!pending) {
      throw new BadRequestException(
        'No active password reset request found or code has expired.',
      );
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingResets.delete(email);
      throw new BadRequestException(
        'Reset code has expired. Please request a new one.',
      );
    }

    if (pending.otp !== verifyOtpDto.otp.trim()) {
      throw new BadRequestException(
        'Invalid reset code. Please check your email and try again.',
      );
    }

    return {
      success: true,
      message: 'Reset code verified successfully.',
    };
  }

  /**
   * Step 3: Complete Password Reset with verified OTP and new password.
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{
    success: boolean;
    message: string;
  }> {
    const email = resetPasswordDto.email.toLowerCase().trim();
    const pending = this.pendingResets.get(email);

    if (!pending) {
      throw new BadRequestException(
        'No active password reset request found. Please request a new code.',
      );
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingResets.delete(email);
      throw new BadRequestException(
        'Reset code has expired. Please request a new code.',
      );
    }

    if (pending.otp !== resetPasswordDto.otp.trim()) {
      throw new BadRequestException(
        'Invalid reset code. Please check your email and try again.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const hashedPassword = await bcrypt.hash(
      resetPasswordDto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    // Update password and invalidate active sessions
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        hashedRefreshToken: null,
      },
    });

    this.pendingResets.delete(email);

    return {
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    };
  }

  /**
   * Resend password reset OTP.
   */
  async resendResetOtp(email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.forgotPassword({ email: normalizedEmail });
  }

  // ────────────────────────────────────────────────────────────
  // Administrative Registration
  // ────────────────────────────────────────────────────────────

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

    const email = registerAdminDto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
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
        email,
        name: registerAdminDto.name.trim(),
        password: hashedPassword,
        phone: registerAdminDto.phone?.trim() || null,
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

  // ────────────────────────────────────────────────────────────
  // Login, Token Rotation & Profile
  // ────────────────────────────────────────────────────────────

  /**
   * Authenticate user with email and password.
   * Generates new JWT pair and updates DB with hashed refresh token.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const email = loginDto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
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
      await this.prisma.user.update({
        where: { id: user.id },
        data: { hashedRefreshToken: null },
      });
      throw new UnauthorizedException(
        'Access Denied: Security violation detected, token invalidated',
      );
    }

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
