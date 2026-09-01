import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackReturnDto {
  @ApiProperty({
    example: 'RET-20260901-4821',
    description: 'Unique return tracking reference generated during request creation',
  })
  @IsString()
  @IsNotEmpty({ message: 'returnReference is required' })
  returnReference!: string;

  @ApiProperty({
    example: 'noman@example.com',
    description: 'Phone number or email address associated with the order',
  })
  @IsString()
  @IsNotEmpty({ message: 'emailOrPhone is required' })
  emailOrPhone!: string;
}
