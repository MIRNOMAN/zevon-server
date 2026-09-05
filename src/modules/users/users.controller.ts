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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
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

// Ensure avatar upload directory exists
const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(AVATAR_UPLOAD_DIR)) {
  mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}

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

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Profile avatar uploaded successfully')
  @ApiOperation({ summary: 'Upload customer profile avatar image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file (JPG, PNG, WEBP, GIF, max 5MB)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, AVATAR_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `avatar-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/i)) {
          return cb(
            new BadRequestException(
              'Only JPG, PNG, WEBP, and GIF images are allowed',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const updatedUser = await this.usersService.updateProfile(userId, {
      avatarUrl,
    });
    return {
      avatarUrl,
      user: updatedUser,
      message: 'Avatar uploaded and updated successfully',
    };
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
