import { PartialType } from '@nestjs/swagger';
import { CreateLookbookDto } from './create-lookbook.dto.js';

export class UpdateLookbookDto extends PartialType(CreateLookbookDto) {}
