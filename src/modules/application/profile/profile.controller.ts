import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Put,
  UseInterceptors,
  UploadedFile,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import {
  CreateEducationDto,
  CreateExperienceDto,
  CreatePublicationDto,
  CreateSkillDto,
} from './dto/create-profile.dto';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: Request) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Post('education')
  createEducation(
    @Body() createEducationDto: CreateEducationDto,
    @Req() req: Request,
  ) {
    return this.profileService.createEducation(
      req.user.userId,
      createEducationDto,
    );
  }
  @Post('experience')
  createExperience(
    @Body() createExperienceDto: CreateExperienceDto,
    @Req() req: Request,
  ) {
    return this.profileService.createExperience(
      req.user.userId,
      createExperienceDto,
    );
  }
  @Post('skill')
  createSkill(@Body() createSkillDto: CreateSkillDto, @Req() req: Request) {
    return this.profileService.createSkill(req.user.userId, createSkillDto);
  }
  @Post('publication')
  createPublication(
    @Body() createPublicationDto: CreatePublicationDto,
    @Req() req: Request,
  ) {
    return this.profileService.createPublication(
      req.user.userId,
      createPublicationDto,
    );
  }

  @Put('cv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  updateCV(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.updateCV(req.user.userId, file);
  }

  @Delete('education/:id')
  deleteEducation(@Param('id') id: string, @Req() req: Request) {
    return this.profileService.deleteEducation(id, req.user.userId);
  }
  @Delete('experience/:id')
  deleteExperience(@Param('id') id: string, @Req() req: Request) {
    return this.profileService.deleteExperience(id, req.user.userId);
  }
  @Delete('skill/:id')
  deleteSkill(@Param('id') id: string, @Req() req: Request) {
    return this.profileService.deleteSkill(id, req.user.userId);
  }
  @Delete('publication/:id')
  deletePublication(@Param('id') id: string, @Req() req: Request) {
    return this.profileService.deletePublication(id, req.user.userId);
  }
}
