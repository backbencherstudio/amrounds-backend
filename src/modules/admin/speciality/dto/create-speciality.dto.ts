import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateTopicDto {
  @ApiProperty({
    description: 'Topic name',
    example: 'Heart Failure',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Whether topic is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  is_active?: boolean = true;

  @ApiPropertyOptional({
    description: 'Image URL or file name if already hosted',
  })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional({
    description: 'Index of the image file in the uploaded files array',
  })
  @IsOptional()
  image_index?: number;
}

export class CreateSpecialityDto {
  @ApiProperty({
    description: 'Speciality name',
    example: 'Cardiology',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Whether speciality is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  is_active?: boolean = true;

  @ApiPropertyOptional({
    description: 'Speciality cover image URL if already hosted',
  })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional({
    description: 'List of topics under this speciality (can be passed as JSON string in multipart/form-data)',
    type: [CreateTopicDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTopicDto)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return value;
      }
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.values(value);
    }
    return value;
  })
  topics?: CreateTopicDto[];
}

