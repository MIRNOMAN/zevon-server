import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import {
  VoiceSearchDto,
  VisualSearchDto,
  ComplementarySearchDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('AI Search (Voice Search & Visual Image Search)')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Post('voice')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Voice query processed successfully')
  @ApiOperation({
    summary:
      'Voice Search Engine: Natural language speech parser extracting colors, garments, price bounds, sizes, and occasions with multi-attribute weighted ranking (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Ranked products matching spoken intent with parsedIntent token chips for the frontend UI',
  })
  voiceSearch(@Body() dto: VoiceSearchDto) {
    return this.searchService.voiceSearch(dto);
  }

  @Public()
  @Post('visual')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ResponseMessage('Visual image search analyzed successfully')
  @ApiOperation({
    summary:
      'Visual Image Search Engine: Upload outfit photo or pass image URL -> extracts dominant color palette, calculates Delta-E color distance against product variants, and returns closest matching products (Public)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Uploaded outfit / clothing photo file',
        },
        imageUrl: {
          type: 'string',
          example: 'https://assets.zevon.com/samples/customer-outfit-photo.jpg',
          description: 'Alternative URL to an image',
        },
        hexColor: {
          type: 'string',
          example: '#1E293B',
          description: 'Optional hex color for targeted color search',
        },
        categoryHint: {
          type: 'string',
          example: 'Topwear',
          description: 'Optional category filter',
        },
        limit: {
          type: 'number',
          example: 12,
          default: 12,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Visual palette breakdown, detected tone, and ranked catalog products with similarity percentage scores (e.g. 96% Match)',
  })
  visualSearch(
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname?: string;
          mimetype?: string;
          size?: number;
        }
      | undefined,
    @Body() dto: VisualSearchDto,
  ) {
    const buffer = file?.buffer ?? null;
    return this.searchService.visualSearch(buffer, dto);
  }

  @Public()
  @Get('complementary/:productId')
  @ResponseMessage('Complementary styling recommendations fetched')
  @ApiOperation({
    summary:
      'Complementary Outfit Suggestions: Color harmony engine that recommends matching Top, Bottom, or Shoes for a selected garment (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Curated list of harmonizing garments with style pairing rationale',
  })
  getComplementarySuggestions(
    @Param('productId') productId: string,
    @Query() dto: ComplementarySearchDto,
  ) {
    return this.searchService.getComplementarySuggestions(productId, dto);
  }
}
