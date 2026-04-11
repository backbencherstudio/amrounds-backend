import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  limit?: number = 10;
}

export enum DiscoverProfileType {
  All = 'all',
  Following = 'following',
  Follower = 'follower',
}

export class ConnectionsQueryDTO extends PaginationDto {
  @IsOptional()
  @IsEnum(DiscoverProfileType)
  type?: DiscoverProfileType = DiscoverProfileType.All;

  @IsOptional()
  @IsString()
  user_id?: string;
}

export class DiscoverProfileQueryDTO extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
