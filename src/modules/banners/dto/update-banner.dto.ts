import { PartialType } from '@nestjs/swagger';
import { CreateBannerDto } from './create-banner.dto.js';

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
