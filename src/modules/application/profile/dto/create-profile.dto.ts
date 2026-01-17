import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProfileDto {}

export class CreateEducationDto {
  @IsNotEmpty()
  @IsString()
  degree: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  institute: string;

  @IsNotEmpty()
  @IsString()
  year: string;
}

export class CreateExperienceDto {
  @IsNotEmpty()
  @IsString()
  company: string;

  @IsNotEmpty()
  @IsString()
  position: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsString()
  start_date: string;

  @IsNotEmpty()
  @IsString()
  end_date: string;
}

export class CreateSkillDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class CreatePublicationDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  topic: string;

  @IsNotEmpty()
  @IsString()
  link: string;

  @IsNotEmpty()
  @IsString()
  year: string;
}
