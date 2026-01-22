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
import { DiscoverProfileQueryDTO } from './dto/query-profile.dto';
import { Prisma } from 'prisma/generated/client';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async discoverProfile(user_id: string, query: DiscoverProfileQueryDTO) {
    const { search = '', page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    // 1. Fetch current user data for suggestion matching
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user_id },
      include: {
        educations: true,
        experiences: true,
        skills: true,
        publications: true,
      },
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    // Prepare arrays for matching (Lowercased for loose matching)
    // We join them with a delimiter to pass as a single string and unnest in SQL for fuzzy matching
    const delimiter = '<->';
    const joinForSql = (arr: string[]) => arr.join(delimiter);

    const skillNames = currentUser.skills
      .map((s) => s.name?.toLowerCase())
      .filter(Boolean);
    const institutes = currentUser.educations
      .map((e) => e.institute?.toLowerCase())
      .filter(Boolean);
    const degrees = currentUser.educations
      .map((e) => e.degree?.toLowerCase())
      .filter(Boolean);
    const companies = currentUser.experiences
      .map((e) => e.company?.toLowerCase())
      .filter(Boolean);
    const positions = currentUser.experiences
      .map((e) => e.position?.toLowerCase())
      .filter(Boolean);
    const topics = currentUser.publications
      .map((p) => p.topic?.toLowerCase())
      .filter(Boolean);

    // Helpers to safely join strings for SQL IN clauses or similar logic
    // Since we are using raw query, we must be careful with arrays.
    // For simplicity in raw SQL with array matching, we can use specific SQL constructions
    // but Prisma $queryRaw supports parameter substitution which is safer.

    // 2. Enable pg_trgm extension if not exists (Best effort)
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      );
    } catch (e) {
      // Ignore permission errors if already enabled or not allowed
    }

    // 3. Build the Query
    // We will select users and calculate scores.
    // Note: Parameterized query is complex with dynamic arrays.
    // We'll use a mix of raw text matching and exact matches.

    // Base similarity for search
    // We'll default search to empty string if not provided to avoid null issues in similarity
    const searchTerm = search || '';

    // Calculate Suggestion Score Logic in SQL:
    // We'll add points for matching fields.
    // Explicitly casting to text to ensure type safety in raw query

    // Constructing the array parts of the query is tricky with template literals and arrays.
    // We will do precise values checks.

    const users: any[] = await this.prisma.$queryRaw`
      SELECT 
        u.id, 
        u.name, 
        u.username, 
        u.avatar, 
        u.bio, 
        u.training_practice, 
        u.current_practice,
        -- Calculate Suggestion Rank
        (
          (COALESCE(similarity(LOWER(u.training_practice), ${(currentUser.training_practice || '').toLowerCase()}), 0) * 5) +
          (COALESCE(similarity(LOWER(u.current_practice), ${(currentUser.current_practice || '').toLowerCase()}), 0) * 5) +
          
          -- Overlap in Skills (Fuzzy Match)
          (
            SELECT COUNT(*) FROM skills s 
            WHERE s.user_id = u.id 
            AND ${
              skillNames.length > 0
                ? Prisma.sql`EXISTS (
                    SELECT 1 FROM unnest(string_to_array(${joinForSql(skillNames)}, ${delimiter})) as k 
                    WHERE similarity(LOWER(s.name), k) > 0.4
                  )`
                : Prisma.sql`FALSE`
            }
          ) * 3 +
          
          -- Overlap in Education (Fuzzy Match)
          (
            SELECT COUNT(*) FROM educations e 
            WHERE e.user_id = u.id 
            AND (
              ${
                institutes.length > 0
                  ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(institutes)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(e.institute), k) > 0.4
                    )`
                  : Prisma.sql`FALSE`
              }
              OR 
              ${
                degrees.length > 0
                  ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(degrees)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(e.degree), k) > 0.4
                    )`
                  : Prisma.sql`FALSE`
              }
            )
          ) * 2 +
          
          -- Overlap in Experience (Fuzzy Match)
          (
            SELECT COUNT(*) FROM experiences ex 
            WHERE ex.user_id = u.id 
            AND (
              ${
                companies.length > 0
                  ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(companies)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(ex.company), k) > 0.4
                    )`
                  : Prisma.sql`FALSE`
              }
              OR 
              ${
                positions.length > 0
                  ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(positions)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(ex.position), k) > 0.4
                    )`
                  : Prisma.sql`FALSE`
              }
            )
          ) * 2 +

          -- Overlap in Publications (Fuzzy Match)
          (
            SELECT COUNT(*) FROM publications p 
            WHERE p.user_id = u.id 
            AND ${
              topics.length > 0
                ? Prisma.sql`EXISTS (
                    SELECT 1 FROM unnest(string_to_array(${joinForSql(topics)}, ${delimiter})) as k 
                    WHERE similarity(LOWER(p.topic), k) > 0.4
                  )`
                : Prisma.sql`FALSE`
            }
          ) * 2
        ) as suggestion_rank,

        -- Calculate Search Rank (only if search term is provided, else 0)
        ${
          searchTerm
            ? Prisma.sql`(similarity(u.name, ${searchTerm}) + similarity(u.username, ${searchTerm}) + similarity(u.bio, ${searchTerm}))`
            : Prisma.sql`0`
        } as search_rank

      FROM users u
<<<<<<< HEAD
      WHERE u.id != ${user_id}
      AND u.is_public = true 
      AND u.status = 1
      AND u.type != 'admin'
      AND NOT (u.approved = false AND u.approved_at IS NULL)
=======
      WHERE u.id != ${user_id} 
      AND u.status = 1
>>>>>>> 521c82a (feat: Introduce profile module with discovery, retrieval, and education management functionalities.)
      ${
        searchTerm
          ? Prisma.sql`AND (
            u.name ILIKE ${'%' + searchTerm + '%'} 
            OR u.username ILIKE ${'%' + searchTerm + '%'}
            OR u.bio ILIKE ${'%' + searchTerm + '%'}
          )`
          : Prisma.sql``
      }
      ORDER BY 
        ${searchTerm ? Prisma.sql`search_rank DESC,` : Prisma.sql``}
        suggestion_rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Count total for pagination meta (simplified, maybe separate query)
    // For now, return list
    return {
      success: true,
      data: users,
      meta: {
        page: Number(page),
        limit: Number(limit),
      },
    };
  }

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
