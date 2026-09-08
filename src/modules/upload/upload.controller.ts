import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UploadService, UploadResult } from './upload.service.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Media & Image Upload (MinIO)')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Public()
  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Image uploaded successfully to MinIO')
  @ApiOperation({ summary: 'Upload single image to MinIO S3 bucket' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    example: 'products',
    description: 'Target folder inside bucket (e.g. products, banners, lookbooks)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Returns public CDN/MinIO image URL and object key',
  })
  async uploadSingleImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ): Promise<UploadResult> {
    return this.uploadService.uploadFile(file, folder || 'products');
  }

  @Public()
  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ResponseMessage('Multiple images uploaded successfully to MinIO')
  @ApiOperation({ summary: 'Upload up to 10 images simultaneously to MinIO S3 bucket' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    example: 'products',
  })
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: string,
  ): Promise<UploadResult[]> {
    return this.uploadService.uploadMultipleFiles(files, folder || 'products');
  }
}
