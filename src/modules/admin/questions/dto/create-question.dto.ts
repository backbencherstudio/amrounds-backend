import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum difficulty {
  Intern = 'Intern',
  Board = 'Board',
  Senior = 'Senior',
}

export enum topic {
  Anesthesia_Medicine = 'Anesthesia_Medicine',
  Cancer = 'Cancer',
  Cleft_Craniofacial = 'Cleft_Craniofacial',
  Cosmetics = 'Cosmetics',
  Dentoalveolar = 'Dentoalveolar',
  Implants = 'Implants',
  Orthognathic = 'Orthognathic',
  Pathology = 'Pathology',
  Recontraction = 'Recontraction',
  TMJ = 'TMJ',
  Trauma = 'Trauma',
}

export class CreateAnswerOptionDto {
  @IsString()
  @IsNotEmpty()
  option_text: string;

  @IsBoolean()
  @IsOptional()
  is_correct?: boolean;

  @IsString()
  @IsOptional()
  id?: string;
}

export class CreateAnswerOptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  create: CreateAnswerOptionDto[];
}

export class CreateQuestionDto {
  @IsString()
  @IsOptional()
  question_title?: string;

  @IsString()
  @IsNotEmpty()
  question_steam: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  why_incorrect?: string;

  @IsString()
  @IsOptional()
  pimping_point?: string;

  @IsString()
  @IsOptional()
  memory_trick?: string;

  @IsString()
  @IsOptional()
  referance?: string;

  @IsEnum(difficulty)
  @IsNotEmpty()
  difficulty: difficulty;

  @IsArray()
  @IsEnum(topic, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value.split(',').map((item) => item.trim());
      }
    }
    return value;
  })
  topic: topic[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  answerOptions: CreateAnswerOptionDto[];
}
