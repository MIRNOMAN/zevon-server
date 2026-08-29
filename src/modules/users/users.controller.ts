import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateProfileDto,
  ChangePasswordDto,
  UpdateRoleDto,
  UpdateStatusDto,
} from './dto/index.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('User & Profile Management')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Profile Endpoints (Authenticated Customer/User) ──────────

  @Get('me')
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({
    summary: 'Get current authenticated user profile with addresses',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User profile returned' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({
    summary: 'Update profile information (name, phone, avatarUrl)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Patch('change-password')
  @ResponseMessage('Password changed successfully')
  @ApiOperation({ summary: 'Change user account password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed and active sessions revoked',
  })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  // ── Admin Endpoints (RBAC Protected) ──────────────────────────

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User created successfully by admin')
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('Users list retrieved successfully')
  @ApiOperation({
    summary: 'List all users with pagination and search (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'role', enum: Role, required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: Role,
    @Query('search') search?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.usersService.findAll(pageNumber, limitNumber, role, search);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('User details retrieved successfully')
  @ApiOperation({ summary: 'Get user details by ID (Admin/Manager)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update user information (Admin only)' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ResponseMessage('User role updated successfully')
  @ApiOperation({ summary: 'Update user role (ADMIN only)' })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.usersService.updateRole(id, updateRoleDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @ResponseMessage('User active status updated successfully')
  @ApiOperation({
    summary: 'Activate or deactivate user account (Admin/Manager)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ResponseMessage('User deleted successfully')
  @ApiOperation({ summary: 'Delete user account (Admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
