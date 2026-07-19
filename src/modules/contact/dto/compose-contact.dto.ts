import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ComposeContactDto {
  @ApiProperty({ description: 'Recipient email address', example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  to: string;

  @ApiPropertyOptional({ description: 'Recipient display name', example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Following up on your enquiry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: 'Email body text' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000)
  body: string;
}
