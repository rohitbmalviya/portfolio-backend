import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'Visitor display name', example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Visitor email address', example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ description: 'Optional subject line', example: 'Collaboration opportunity' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: 'Message body', example: 'Hi Rohit, I loved your portfolio...' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}
