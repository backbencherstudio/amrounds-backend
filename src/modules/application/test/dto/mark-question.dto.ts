import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class MarkQuestionDto {
  @IsString()
  @IsNotEmpty()
  test_id: string;

  @IsString()
  @IsNotEmpty()
  question_id: string;

  @IsBoolean()
  @IsNotEmpty()
  is_marked: boolean;
}
