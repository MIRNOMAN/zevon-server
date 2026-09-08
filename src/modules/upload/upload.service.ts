import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
}

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private minioClient: MinioClient;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;

  constructor(private readonly configService: ConfigService) {
    let rawEndpoint =
      this.configService.get<string>('AWS_S3_ENDPOINT_URL') ||
      this.configService.get<string>('MI_SPACE_ENDPOINT') ||
      'api.zenexcloud.com';

    let ssl = true;
    if (rawEndpoint.startsWith('https://')) {
      ssl = true;
      rawEndpoint = rawEndpoint.replace('https://', '');
    } else if (rawEndpoint.startsWith('http://')) {
      ssl = false;
      rawEndpoint = rawEndpoint.replace('http://', '');
    } else {
      ssl = this.configService.get<string>('MI_USE_SSL') !== 'false';
    }

    // Clean any trailing slashes or ports from hostname
    if (rawEndpoint.includes(':')) {
      const parts = rawEndpoint.split(':');
      this.endpoint = parts[0];
      this.port = parseInt(parts[1], 10);
    } else {
      this.endpoint = rawEndpoint.replace(/\/$/, '');
      const configuredPort = this.configService.get<string>('MI_PORT');
      this.port = configuredPort ? parseInt(configuredPort, 10) : (ssl ? 443 : 9000);
    }

    this.useSSL = ssl;

    this.bucket =
      this.configService.get<string>('AWS_STORAGE_BUCKET_NAME') ||
      this.configService.get<string>('MI_SPACE_BUCKET') ||
      'emdadullah';

    const accessKey =
      this.configService.get<string>('AWS_ACCESS_KEY_ID') ||
      this.configService.get<string>('MI_SPACE_ACCESS_KEY') ||
      '';
    const secretKey =
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('MI_SPACE_SECRET_KEY') ||
      '';

    this.minioClient = new MinioClient({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  /**
   * Ensure target bucket exists and has public read access for storefront/dashboard imagery
   */
  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }

      // Ensure public read policy
      const publicReadPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };

      try {
        await this.minioClient.setBucketPolicy(
          this.bucket,
          JSON.stringify(publicReadPolicy),
        );
      } catch (err: unknown) {
        this.logger.warn(`Could not set bucket policy: ${(err as Error).message}`);
      }

      this.logger.log(
        `MinIO connected successfully to bucket "${this.bucket}" on ${this.endpoint}:${this.port} (SSL: ${this.useSSL})`,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `MinIO bucket initialization notice: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Upload a single image/file buffer to MinIO
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'products',
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/avif',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, GIF, SVG, AVIF`,
      );
    }

    // Max 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum allowed 10MB');
    }

    const ext = path.extname(file.originalname) || '.webp';
    const cleanName = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const objectKey = `${folder}/${Date.now()}-${cleanName}-${randomUUID().slice(0, 6)}${ext}`;

    try {
      const metaData = {
        'Content-Type': file.mimetype,
      };

      await this.minioClient.putObject(
        this.bucket,
        objectKey,
        file.buffer,
        file.size,
        metaData,
      );

      const protocol = this.useSSL ? 'https' : 'http';
      const portPart =
        (this.port === 80 && !this.useSSL) ||
        (this.port === 443 && this.useSSL)
          ? ''
          : `:${this.port}`;
      const url = `${protocol}://${this.endpoint}${portPart}/${this.bucket}/${objectKey}`;

      return {
        url,
        key: objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: this.bucket,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to upload file to MinIO: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        `Failed to upload image to MinIO: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Upload multiple files in parallel
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'products',
  ): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }
}
