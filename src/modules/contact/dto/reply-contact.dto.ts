import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReplyContactDto {
  @ApiProperty({ description: 'Reply message body' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;
}
