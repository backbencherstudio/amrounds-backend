import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';

export enum Status {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class GetAllUserDto {
  @IsOptional()
  @IsEnum(Status)
  status: Status = Status.PENDING;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit: number = 10;
}
