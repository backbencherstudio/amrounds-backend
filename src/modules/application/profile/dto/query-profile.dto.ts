import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class DiscoverProfileQueryDTO {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform((value) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Transform((value) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number = 10;
}
