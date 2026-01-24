import { IsNotEmpty, IsString } from 'class-validator';

export class AnswerTestDto {
  @IsString()
  @IsNotEmpty()
  test_id: string;

  @IsString()
  @IsNotEmpty()
  question_id: string;

  @IsString()
  @IsNotEmpty()
  answer_option_id: string;
}
