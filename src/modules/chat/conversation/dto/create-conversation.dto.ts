import { ApiProperty } from '@nestjs/swagger';
// DTO for creating conversation
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The id of the participant',
  })
  participant_id: string;
}
