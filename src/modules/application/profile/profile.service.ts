import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateEducationDto,
  CreateExperienceDto,
  CreatePublicationDto,
  CreateSkillDto,
} from './dto/create-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(user_id: string) {
    if (!user_id) {
      throw new UnauthorizedException('User not found');
    }
    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        credentials: true,
        training_practice: true,
        address: true,
        current_practice: true,
        bio: true,
        instagram: true,
        linkedin: true,
        twitter_x: true,
        facebook: true,
        type: true,
        cv: true,
        is_public: true,
        email_notification: true,
        website_notification: true,
        educations: {
          select: {
            id: true,
            degree: true,
            description: true,
            institute: true,
            year: true,
          },
          orderBy: {
            year: 'desc',
          },
        },
        experiences: {
          select: {
            id: true,
            company: true,
            position: true,
            location: true,
            start_date: true,
            end_date: true,
          },
          orderBy: {
            start_date: 'desc',
          },
        },
        skills: {
          select: {
            id: true,
            name: true,
          },
        },
        publications: {
          select: {
            id: true,
            topic: true,
            link: true,
            year: true,
          },
          orderBy: {
            year: 'desc',
          },
        },
        _count: {
          select: {
            followings: true,
            followers: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...rest } = user;
    return {
      success: true,
      message: 'Profile fetched successfully',
      data: {
        ...rest,
        avatar: rest.avatar
          ? `${appConfig().storageUrl.avatar}/${rest.avatar}`
          : null,
        cv: rest.cv ? `${appConfig().storageUrl.cv}/${rest.cv}` : null,
        followings: _count.followings,
        followers: _count.followers,
      },
    };
  }

  async createEducation(
    user_id: string,
    createEducationDto: CreateEducationDto,
  ) {
    const education = await this.prisma.education.create({
      data: {
        ...createEducationDto,
        user_id,
      },
      select: {
        id: true,
        degree: true,
        description: true,
        institute: true,
        year: true,
      },
    });
    return {
      success: true,
      message: 'Education created successfully',
      data: education,
    };
  }

  async createExperience(
    user_id: string,
    createExperienceDto: CreateExperienceDto,
  ) {
    const experience = await this.prisma.experience.create({
      data: {
        ...createExperienceDto,
        user_id,
      },
      select: {
        id: true,
        company: true,
        position: true,
        location: true,
        start_date: true,
        end_date: true,
      },
    });
    return {
      success: true,
      message: 'Experience created successfully',
      data: experience,
    };
  }

  async createSkill(user_id: string, createSkillDto: CreateSkillDto) {
    const skill = await this.prisma.skill.create({
      data: {
        ...createSkillDto,
        user_id,
      },
      select: {
        id: true,
        name: true,
      },
    });
    return {
      success: true,
      message: 'Skill created successfully',
      data: skill,
    };
  }

  async createPublication(
    user_id: string,
    createPublicationDto: CreatePublicationDto,
  ) {
    const publication = await this.prisma.publication.create({
      data: {
        ...createPublicationDto,
        user_id,
      },
      select: {
        id: true,
        topic: true,
        link: true,
        year: true,
      },
    });
    return {
      success: true,
      message: 'Publication created successfully',
      data: publication,
    };
  }

  async updateCV(user_id: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
    });
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Delete old CV if exists
    if (user.cv) {
      try {
        await SojebStorage.delete(appConfig().storageUrl.cv + '/' + user.cv);
      } catch (error) {
        // Log error but continue with upload
        console.error('Failed to delete old CV:', error);
      }
    }

    // Generate new filename
    const fileName = user.name + '_' + 'cv' + '.' + file.mimetype.split('/')[1];

    // Upload new CV
    try {
      await SojebStorage.put(
        appConfig().storageUrl.cv + '/' + fileName,
        file.buffer,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to upload CV');
    }

    // Update user record
    const updatedUser = await this.prisma.user.update({
      where: {
        id: user_id,
      },
      data: {
        cv: fileName,
      },
    });

    return {
      success: true,
      message: 'Resume updated successfully',
      data: updatedUser,
    };
  }

  async deleteEducation(id: string, user_id: string) {
    await this.prisma.education.delete({
      where: {
        id,
        user_id,
      },
    });
    return {
      success: true,
      message: 'Education deleted successfully',
    };
  }

  async deleteExperience(id: string, user_id: string) {
    await this.prisma.experience.delete({
      where: {
        id,
        user_id,
      },
    });
    return {
      success: true,
      message: 'Experience deleted successfully',
    };
  }

  async deleteSkill(id: string, user_id: string) {
    await this.prisma.skill.delete({
      where: {
        id,
        user_id,
      },
    });
    return {
      success: true,
      message: 'Skill deleted successfully',
    };
  }

  async deletePublication(id: string, user_id: string) {
    await this.prisma.publication.delete({
      where: {
        id,
        user_id,
      },
    });
    return {
      success: true,
      message: 'Publication deleted successfully',
    };
  }
}
