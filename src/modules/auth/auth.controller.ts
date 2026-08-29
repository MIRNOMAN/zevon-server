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
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Customer registration successful')
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created with Access & Refresh tokens',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('register-admin')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Administrative user registered successfully')
  @ApiOperation({
    summary: 'Register an Admin or Manager account with Admin Secret Key',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Admin/Manager created with Access & Refresh tokens',
  })
  async registerAdmin(@Body() registerAdminDto: RegisterAdminDto) {
    return this.authService.registerAdmin(registerAdminDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'JWT Access & Refresh tokens returned',
  })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New Access & Refresh tokens returned',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session revoked successfully',
  })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Profile fetched successfully')
  @ApiOperation({ summary: 'Get profile of current logged-in user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User details returned',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
