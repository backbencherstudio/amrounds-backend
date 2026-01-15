import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHelpDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  privacy_policy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  disclaimer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  terms_of_conditions?: string;
}
