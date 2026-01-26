import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEmpty, IsNotEmpty, IsString } from 'class-validator';

export class CreateContactDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;
  @ApiProperty()
  @IsEmpty()
  first_name?: string;

  @ApiProperty()
  @IsEmpty()
  last_name?: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsEmpty()
  phone_number?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  message: string;
}
