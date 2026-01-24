import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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

export enum TestMode {
  USED = 'used',
  UNUSED = 'unused',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  OMITTED = 'omitted',
  MARKED = 'marked',
}

export class CreateTestDto {
  @IsInt()
  @IsNotEmpty()
  total_questions: number;

  @IsEnum(TestMode)
  @IsNotEmpty()
  test_mode: TestMode;

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
}
