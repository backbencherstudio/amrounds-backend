import { ApiProperty } from '@nestjs/swagger';
import { IsEmpty, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty()
  name?: string;

  @IsNotEmpty()
  @ApiProperty()
  email?: string;

  @IsEmpty()
  @ApiProperty()
  first_name?: string;

  @IsEmpty()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;

  @IsNotEmpty()
  @ApiProperty()
  credentials: string;

  @IsNotEmpty()
  @ApiProperty()
  training_practice: string;

  @IsNotEmpty()
  @ApiProperty()
  country: string;

  @IsNotEmpty()
  @ApiProperty()
  state: string;

  @IsOptional()
  @ApiProperty()
  address?: string;

  @IsOptional()
  @ApiProperty()
  current_practice?: string;

  @IsOptional()
  @ApiProperty()
  specialty?: string;

  @IsOptional()
  @ApiProperty()
  bio: string;

  @IsOptional()
  @ApiProperty()
  instagram: string;

  @IsOptional()
  @ApiProperty()
  linkedin: string;

  @IsOptional()
  @ApiProperty()
  twitter_x: string;

  @IsOptional()
  @ApiProperty()
  facebook: string;

  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: string;
}
