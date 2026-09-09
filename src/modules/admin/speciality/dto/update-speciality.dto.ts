import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSpecialityDto {
  @ApiPropertyOptional({
    description: 'Speciality name',
    example: 'Cardiology',
  })
  @IsString({ message: 'Speciality name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Speciality name must be at most 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({
    description: 'Whether speciality is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Speciality cover image URL if already hosted',
  })
  @IsString()
  @IsOptional()
  image_url?: string;
}

export class AddTopicDto {
  @ApiProperty({
    description: 'Topic name',
    example: 'Heart Failure',
  })
  @IsString({ message: 'Topic name must be a string' })
  @IsNotEmpty({ message: 'Topic name is required' })
  @MaxLength(255, { message: 'Topic name must be at most 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiPropertyOptional({
    description: 'Whether topic is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  is_active?: boolean = true;

  @ApiPropertyOptional({
    description: 'Topic image URL if already hosted',
  })
  @IsString()
  @IsOptional()
  image_url?: string;
}

export class UpdateTopicDto {
  @ApiPropertyOptional({
    description: 'Topic name',
    example: 'Heart Failure',
  })
  @IsString({ message: 'Topic name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Topic name must be at most 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({
    description: 'Whether topic is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Topic image URL if already hosted',
  })
  @IsString()
  @IsOptional()
  image_url?: string;
}

