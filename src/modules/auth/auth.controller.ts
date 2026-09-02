import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  RegisterDto,
  RegisterAdminDto,
  LoginDto,
  RefreshTokenDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendOtpDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ────────────────────────────────────────────────────────────
  // Registration Flow (with Email OTP)
  // ────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Verification OTP code sent to your email')
  @ApiOperation({ summary: 'Initiate customer registration and send OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '6-digit OTP code dispatched to email',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('verify-register-otp')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Account verified and created successfully')
  @ApiOperation({ summary: 'Verify registration OTP and create customer account' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created successfully',
  })
  async verifyRegisterOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyRegisterOtp(verifyOtpDto);
  }

  @Public()
  @Post('resend-register-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('New verification OTP code sent')
  @ApiOperation({ summary: 'Resend registration OTP code' })
  async resendRegisterOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendRegisterOtp(resendOtpDto.email);
  }

  // ────────────────────────────────────────────────────────────
  // Forgot Password & Reset Flow (with Email OTP)
  // ────────────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset OTP code sent to your email')
  @ApiOperation({ summary: 'Request password reset OTP code' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset code verified')
  @ApiOperation({ summary: 'Verify password reset OTP code' })
  async verifyResetOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(verifyOtpDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully')
  @ApiOperation({ summary: 'Reset password using OTP verification code' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('resend-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('New password reset OTP sent')
  @ApiOperation({ summary: 'Resend password reset OTP code' })
  async resendResetOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendResetOtp(resendOtpDto.email);
  }

  // ────────────────────────────────────────────────────────────
  // Administrative Registration
  // ────────────────────────────────────────────────────────────

  @Public()
  @Post('register-admin')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Administrative user registered successfully')
  @ApiOperation({
    summary: 'Register an Admin or Manager account with Admin Secret Key',
  })
  async registerAdmin(@Body() registerAdminDto: RegisterAdminDto) {
    return this.authService.registerAdmin(registerAdminDto);
  }

  // ────────────────────────────────────────────────────────────
  // Login, Tokens & Profile
  // ────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token rotated successfully')
  @ApiOperation({
    summary: 'Rotate Access Token and Refresh Token using valid Refresh Token',
  })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Successfully logged out and session revoked')
  @ApiOperation({
    summary: 'Logout and revoke refresh token session in database',
  })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Profile fetched successfully')
  @ApiOperation({ summary: 'Get profile of current logged-in user' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
