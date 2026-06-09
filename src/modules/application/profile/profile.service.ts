import {
  HttpException,
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
import { Prisma } from 'prisma/generated/client';
import {
  ConnectionsQueryDTO,
  DiscoverProfileQueryDTO,
  DiscoverProfileType,
  PaginationDto,
} from './dto/query-profile.dto';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';

const allCountriesRaw = [
  { code: 'af', name: 'Afghanistan' }, { code: 'al', name: 'Albania' }, { code: 'dz', name: 'Algeria' },
  { code: 'as', name: 'American Samoa' }, { code: 'ad', name: 'Andorra' }, { code: 'ao', name: 'Angola' },
  { code: 'ai', name: 'Anguilla' }, { code: 'aq', name: 'Antarctica' }, { code: 'ag', name: 'Antigua and Barbuda' },
  { code: 'ar', name: 'Argentina' }, { code: 'am', name: 'Armenia' }, { code: 'aw', name: 'Aruba' },
  { code: 'au', name: 'Australia' }, { code: 'at', name: 'Austria' }, { code: 'az', name: 'Azerbaijan' },
  { code: 'bs', name: 'Bahamas' }, { code: 'bh', name: 'Bahrain' }, { code: 'bd', name: 'Bangladesh' },
  { code: 'bb', name: 'Barbados' }, { code: 'by', name: 'Belarus' }, { code: 'be', name: 'Belgium' },
  { code: 'bz', name: 'Belize' }, { code: 'bj', name: 'Benin' }, { code: 'bm', name: 'Bermuda' },
  { code: 'bt', name: 'Bhutan' }, { code: 'bo', name: 'Bolivia' }, { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'bw', name: 'Botswana' }, { code: 'br', name: 'Brazil' }, { code: 'bn', name: 'Brunei' },
  { code: 'bg', name: 'Bulgaria' }, { code: 'bf', name: 'Burkina Faso' }, { code: 'bi', name: 'Burundi' },
  { code: 'kh', name: 'Cambodia' }, { code: 'cm', name: 'Cameroon' }, { code: 'ca', name: 'Canada' },
  { code: 'cv', name: 'Cape Verde' }, { code: 'ky', name: 'Cayman Islands' }, { code: 'cf', name: 'Central African Republic' },
  { code: 'td', name: 'Chad' }, { code: 'cl', name: 'Chile' }, { code: 'cn', name: 'China' },
  { code: 'co', name: 'Colombia' }, { code: 'km', name: 'Comoros' }, { code: 'cg', name: 'Congo' },
  { code: 'cr', name: 'Costa Rica' }, { code: 'hr', name: 'Croatia' }, { code: 'cu', name: 'Cuba' },
  { code: 'cy', name: 'Cyprus' }, { code: 'cz', name: 'Czech Republic' }, { code: 'dk', name: 'Denmark' },
  { code: 'dj', name: 'Djibouti' }, { code: 'dm', name: 'Dominica' }, { code: 'do', name: 'Dominican Republic' },
  { code: 'ec', name: 'Ecuador' }, { code: 'eg', name: 'Egypt' }, { code: 'sv', name: 'El Salvador' },
  { code: 'gq', name: 'Equatorial Guinea' }, { code: 'er', name: 'Eritrea' }, { code: 'ee', name: 'Estonia' },
  { code: 'et', name: 'Ethiopia' }, { code: 'fj', name: 'Fiji' }, { code: 'fi', name: 'Finland' },
  { code: 'fr', name: 'France' }, { code: 'gf', name: 'French Guiana' }, { code: 'ga', name: 'Gabon' },
  { code: 'gm', name: 'Gambia' }, { code: 'ge', name: 'Georgia' }, { code: 'de', name: 'Germany' },
  { code: 'gh', name: 'Ghana' }, { code: 'gr', name: 'Greece' }, { code: 'gl', name: 'Greenland' },
  { code: 'gd', name: 'Grenada' }, { code: 'gp', name: 'Guadeloupe' }, { code: 'gu', name: 'Guam' },
  { code: 'gt', name: 'Guatemala' }, { code: 'gn', name: 'Guinea' }, { code: 'gw', name: 'Guinea-Bissau' },
  { code: 'gy', name: 'Guyana' }, { code: 'ht', name: 'Haiti' }, { code: 'hn', name: 'Honduras' },
  { code: 'hk', name: 'Hong Kong' }, { code: 'hu', name: 'Hungary' }, { code: 'is', name: 'Iceland' },
  { code: 'in', name: 'India' }, { code: 'id', name: 'Indonesia' }, { code: 'ir', name: 'Iran' },
  { code: 'iq', name: 'Iraq' }, { code: 'ie', name: 'Ireland' }, { code: 'il', name: 'Israel' },
  { code: 'it', name: 'Italy' }, { code: 'jm', name: 'Jamaica' }, { code: 'jp', name: 'Japan' },
  { code: 'jo', name: 'Jordan' }, { code: 'kz', name: 'Kazakhstan' }, { code: 'ke', name: 'Kenya' },
  { code: 'ki', name: 'Kiribati' }, { code: 'kp', name: 'North Korea' }, { code: 'kr', name: 'South Korea' },
  { code: 'kw', name: 'Kuwait' }, { code: 'kg', name: 'Kyrgyzstan' }, { code: 'la', name: 'Laos' },
  { code: 'lv', name: 'Latvia' }, { code: 'lb', name: 'Lebanon' }, { code: 'ls', name: 'Lesotho' },
  { code: 'lr', name: 'Liberia' }, { code: 'ly', name: 'Libya' }, { code: 'li', name: 'Liechtenstein' },
  { code: 'lt', name: 'Lithuania' }, { code: 'lu', name: 'Luxembourg' }, { code: 'mo', name: 'Macao' },
  { code: 'mk', name: 'North Macedonia' }, { code: 'mg', name: 'Madagascar' }, { code: 'mw', name: 'Malawi' },
  { code: 'my', name: 'Malaysia' }, { code: 'mv', name: 'Maldives' }, { code: 'ml', name: 'Mali' },
  { code: 'mt', name: 'Malta' }, { code: 'mh', name: 'Marshall Islands' }, { code: 'mq', name: 'Martinique' },
  { code: 'mr', name: 'Mauritania' }, { code: 'mu', name: 'Mauritius' }, { code: 'mx', name: 'Mexico' },
  { code: 'fm', name: 'Micronesia' }, { code: 'md', name: 'Moldova' }, { code: 'mc', name: 'Monaco' },
  { code: 'mn', name: 'Mongolia' }, { code: 'me', name: 'Montenegro' }, { code: 'ms', name: 'Montserrat' },
  { code: 'ma', name: 'Morocco' }, { code: 'mz', name: 'Mozambique' }, { code: 'mm', name: 'Myanmar' },
  { code: 'na', name: 'Namibia' }, { code: 'nr', name: 'Nauru' }, { code: 'np', name: 'Nepal' },
  { code: 'nl', name: 'Netherlands' }, { code: 'nz', name: 'New Zealand' }, { code: 'ni', name: 'Nicaragua' },
  { code: 'ne', name: 'Niger' }, { code: 'ng', name: 'Nigeria' }, { code: 'no', name: 'Norway' },
  { code: 'om', name: 'Oman' }, { code: 'pk', name: 'Pakistan' }, { code: 'pw', name: 'Palau' },
  { code: 'ps', name: 'Palestine' }, { code: 'pa', name: 'Panama' }, { code: 'pg', name: 'Papua New Guinea' },
  { code: 'py', name: 'Paraguay' }, { code: 'pe', name: 'Peru' }, { code: 'ph', name: 'Philippines' },
  { code: 'pl', name: 'Poland' }, { code: 'pt', name: 'Portugal' }, { code: 'pr', name: 'Puerto Rico' },
  { code: 'qa', name: 'Qatar' }, { code: 're', name: 'Reunion' }, { code: 'ro', name: 'Romania' },
  { code: 'ru', name: 'Russia' }, { code: 'rw', name: 'Rwanda' }, { code: 'kn', name: 'Saint Kitts and Nevis' },
  { code: 'lc', name: 'Saint Lucia' }, { code: 'vc', name: 'Saint Vincent' }, { code: 'ws', name: 'Samoa' },
  { code: 'sm', name: 'San Marino' }, { code: 'st', name: 'Sao Tome and Principe' }, { code: 'sa', name: 'Saudi Arabia' },
  { code: 'sn', name: 'Senegal' }, { code: 'rs', name: 'Serbia' }, { code: 'sc', name: 'Seychelles' },
  { code: 'sl', name: 'Sierra Leone' }, { code: 'sg', name: 'Singapore' }, { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' }, { code: 'sb', name: 'Solomon Islands' }, { code: 'so', name: 'Somalia' },
  { code: 'za', name: 'South Africa' }, { code: 'es', name: 'Spain' }, { code: 'lk', name: 'Sri Lanka' },
  { code: 'sd', name: 'Sudan' }, { code: 'sr', name: 'Suriname' }, { code: 'sz', name: 'Eswatini' },
  { code: 'se', name: 'Sweden' }, { code: 'ch', name: 'Switzerland' }, { code: 'sy', name: 'Syria' },
  { code: 'tw', name: 'Taiwan' }, { code: 'tj', name: 'Tajikistan' }, { code: 'tz', name: 'Tanzania' },
  { code: 'th', name: 'Thailand' }, { code: 'tg', name: 'Togo' }, { code: 'tk', name: 'Tokelau' },
  { code: 'to', name: 'Tonga' }, { code: 'tt', name: 'Trinidad and Tobago' }, { code: 'tn', name: 'Tunisia' },
  { code: 'tr', name: 'Turkey' }, { code: 'tm', name: 'Turkmenistan' }, { code: 'tv', name: 'Tuvalu' },
  { code: 'ug', name: 'Uganda' }, { code: 'ua', name: 'Ukraine' }, { code: 'ae', name: 'United Arab Emirates' },
  { code: 'gb', name: 'United Kingdom' }, { code: 'us', name: 'United States' }, { code: 'uy', name: 'Uruguay' },
  { code: 'uz', name: 'Uzbekistan' }, { code: 'vu', name: 'Vanuatu' }, { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Vietnam' }, { code: 'eh', name: 'Western Sahara' }, { code: 'ye', name: 'Yemen' },
  { code: 'zm', name: 'Zambia' }, { code: 'zw', name: 'Zimbabwe' }
];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private notificationRepository: NotificationRepository,
    private messageGateway: MessageGateway,
  ) { }

  async getProfileStats(user_id: string) {
    const [totalTest, totalCompletedTest, totalScore] =
      await this.prisma.$transaction([
        this.prisma.test.count({
          where: {
            user_id,
          },
        }),
        this.prisma.test.count({
          where: {
            user_id,
            is_completed: true,
          },
        }),
        this.prisma.test.aggregate({
          where: {
            user_id,
            is_completed: true,
          },
          _sum: {
            score: true,
          },
        }),
      ]);

    const avgCorrectPercentage =
      totalScore._sum.score / totalCompletedTest || 0;
    const totalCompletedPercentage = (totalCompletedTest / totalTest) * 100;

    return {
      total_test: totalTest,
      total_completed_test: totalCompletedTest,
      correct_percentage: +avgCorrectPercentage.toFixed(2),
      completed_percentage: +totalCompletedPercentage.toFixed(2),
    };
  }

  async discoverProfile(user_id: string, query: DiscoverProfileQueryDTO) {
    const { search = '', page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

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

    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      );
    } catch (e) { }

    const searchTerm = search || '';

    // Determine all relevant country terms (names and codes) for the search
    const countrySearchTerms: string[] = [];
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      const matchedVariants = new Set<string>();
      matchedVariants.add(searchTerm); // Always search original term

      for (const country of allCountriesRaw) {
        const code = country.code.toLowerCase();
        const name = country.name.toLowerCase();

        const isCodeMatch = code === lowerSearch;
        const isNameMatch = lowerSearch.length > 2 ? name.includes(lowerSearch) : name === lowerSearch;

        if (isCodeMatch || isNameMatch) {
          matchedVariants.add(country.code);
          matchedVariants.add(country.name);
        }
      }
      countrySearchTerms.push(...matchedVariants);
    }

    const [users, totalCount, following] = await Promise.all([
      // Main query for users
      this.prisma.$queryRaw<any[]>`
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
            AND ${skillNames.length > 0
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
              ${institutes.length > 0
          ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(institutes)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(e.institute), k) > 0.4
                    )`
          : Prisma.sql`FALSE`
        }
              OR 
              ${degrees.length > 0
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
              ${companies.length > 0
          ? Prisma.sql`EXISTS (
                      SELECT 1 FROM unnest(string_to_array(${joinForSql(companies)}, ${delimiter})) as k 
                      WHERE similarity(LOWER(ex.company), k) > 0.4
                    )`
          : Prisma.sql`FALSE`
        }
              OR 
              ${positions.length > 0
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
            AND ${topics.length > 0
          ? Prisma.sql`EXISTS (
                    SELECT 1 FROM unnest(string_to_array(${joinForSql(topics)}, ${delimiter})) as k 
                    WHERE similarity(LOWER(p.topic), k) > 0.4
                  )`
          : Prisma.sql`FALSE`
        }
          ) * 2
        ) as suggestion_rank,

        -- Calculate Search Rank (only if search term is provided, else 0)
        ${searchTerm
          ? Prisma.sql`(COALESCE(similarity(u.name, ${searchTerm}), 0) + COALESCE(similarity(u.username, ${searchTerm}), 0) + GREATEST(${Prisma.join(countrySearchTerms.map(term => Prisma.sql`COALESCE(similarity(u.country, ${term}), 0)`))}))`
          : Prisma.sql`0`
        } as search_rank

      FROM users u
      WHERE u.id != ${user_id}
      AND u.is_public = true 
      AND u.status = 1
      AND u.type != 'admin'
      AND NOT (u.approved = false AND u.approved_at IS NULL)
      ${searchTerm
          ? Prisma.sql`AND (
            u.name ILIKE ${'%' + searchTerm + '%'} 
            OR u.username ILIKE ${'%' + searchTerm + '%'}
            OR ${Prisma.join(countrySearchTerms.map(term => Prisma.sql`u.country ILIKE ${'%' + term + '%'}`), ' OR ')}
          )`
          : Prisma.sql``
        }
      ORDER BY 
        ${searchTerm ? Prisma.sql`search_rank DESC,` : Prisma.sql``}
        suggestion_rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,

      // Count total matching users (without pagination)
      this.prisma.$queryRaw<[{ count: string }]>`
      SELECT COUNT(*)::text as count
      FROM users u
      WHERE u.id != ${user_id}
      AND u.is_public = true 
      AND u.status = 1
      AND u.type != 'admin'
      AND NOT (u.approved = false AND u.approved_at IS NULL)
      ${searchTerm
          ? Prisma.sql`AND (
            u.name ILIKE ${'%' + searchTerm + '%'} 
            OR u.username ILIKE ${'%' + searchTerm + '%'}
            OR ${Prisma.join(countrySearchTerms.map(term => Prisma.sql`u.country ILIKE ${'%' + term + '%'}`), ' OR ')}
          )`
          : Prisma.sql``
        }
    `,
      this.prisma.follow.findMany({
        where: {
          follower_id: user_id,
        },
        select: {
          following_id: true,
        },
      }),
    ]);

    const total = parseInt(totalCount[0]?.count || '0');

    return {
      success: true,
      data: await Promise.all(
        users.map(async (user) => {
          return {
            ...user,
            avatar: user.avatar
              ? await SojebStorage.url(
                `${appConfig().storageUrl.avatar}/${user.avatar}`,
              )
              : null,
            is_following: following.some((f) => f.following_id === user.id),
          };
        }),
      ),
      meta_data: {
        page: Number(page),
        limit: Number(limit),
        total: total,
      },
    };
  }

  async getConnections(user_id: string, query: ConnectionsQueryDTO) {
    const {
      page = 1,
      limit = 10,
      type = DiscoverProfileType.All,
      user_id: query_user_id = user_id,
    } = query;

    const where: Prisma.FollowWhereInput = {};
    if (type === DiscoverProfileType.Following) {
      where.follower_id = query_user_id;
    } else if (type === DiscoverProfileType.Follower) {
      where.following_id = query_user_id;
    } else {
      where.OR = [
        { following_id: query_user_id },
        { follower_id: query_user_id },
      ];
    }
    const connections = await this.prisma.follow.findMany({
      where,
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            avatar: true,
            current_practice: true,
            training_practice: true,
          },
        },
        following: {
          select: {
            id: true,
            name: true,
            avatar: true,
            current_practice: true,
            training_practice: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await this.prisma.follow.count({
      where,
    });
    return {
      success: true,
      data: await Promise.all(
        connections.map(async (connection) => {
          let userNode =
            connection.follower_id === query_user_id
              ? connection.following
              : connection.follower;
          return {
            ...userNode,
            avatar: userNode.avatar
              ? await SojebStorage.url(
                `${appConfig().storageUrl.avatar}/${userNode.avatar}`,
              )
              : null,
          };
        }),
      ),
      meta_data: {
        page: Number(page),
        limit: Number(limit),
        total: total,
        type,
      },
    };
  }

  async getProfile(user_id: string) {
    if (!user_id) {
      throw new UnauthorizedException('User not found');
    }

    const [user, testStats, rankResult, topicStats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          credentials: true,
          training_practice: true,
          address: true,
          country: true,
          state: true,
          current_practice: true,
          specialty: true,
          bio: true,
          instagram: true,
          linkedin: true,
          twitter_x: true,
          facebook: true,
          type: true,
          cv: true,
          is_public: true,
          created_at: true,
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
            orderBy: { year: 'desc' },
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
            orderBy: { start_date: 'desc' },
          },
          skills: {
            select: { id: true, name: true },
          },
          publications: {
            select: { id: true, topic: true, link: true, year: true },
            orderBy: { year: 'desc' },
          },
          _count: {
            select: { followings: true, followers: true },
          },
        },
      }),

      // Test stats: complete_percentage & correct_percentage
      this.prisma.$queryRaw<
        {
          total: number;
          completed: number;
          avg_score: number | null;
        }[]
      >`
        SELECT
          COUNT(*)::int as total,
          COUNT(CASE WHEN is_completed = true THEN 1 END)::int as completed,
          AVG(CASE WHEN is_completed = true THEN score END)::float as avg_score
        FROM tests
        WHERE user_id = ${user_id}
      `,

      // Ranking: all-time rank based on accuracy desc, total_tests desc
      this.prisma.$queryRaw<{ rank: number }[]>`
        WITH user_accuracies AS (
          SELECT 
             ua.user_id,
             CASE WHEN COUNT(*) = 0 THEN 0
             ELSE ROUND((COUNT(CASE WHEN ua.is_correct = true THEN 1 END)::numeric / COUNT(*)) * 100)
             END::int as accuracy
          FROM user_answers ua
          GROUP BY ua.user_id
        ),
        base_stats AS (
          SELECT
            t.user_id,
            COUNT(*)::int as total_tests
          FROM tests t
          WHERE t.is_completed = true
          GROUP BY t.user_id
        ),
        combined_stats AS (
          SELECT
            b.user_id,
            b.total_tests,
            COALESCE(a.accuracy, 0) as accuracy
          FROM base_stats b
          LEFT JOIN user_accuracies a ON b.user_id = a.user_id
        ),
        ranked_users AS (
          SELECT
            user_id,
            RANK() OVER (ORDER BY accuracy DESC, total_tests DESC)::int as rank
          FROM combined_stats
        )
        SELECT rank FROM ranked_users
        WHERE user_id = ${user_id}
      `,

      // Best topic: highest correct percentage topic (min 1 attempt)
      this.prisma.$queryRaw<{ topic: string; correct_percentage: number }[]>`
        SELECT
          t::text as topic,
          ROUND(
            (COUNT(CASE WHEN ua.is_correct = true THEN 1 END)::numeric / COUNT(*)) * 100
          )::int as correct_percentage
        FROM user_answers ua
        JOIN questions q ON ua.question_id = q.id
        CROSS JOIN LATERAL unnest(q.topic) as t
        WHERE ua.user_id = ${user_id}
          AND ua.is_correct IS NOT NULL
        GROUP BY t
        ORDER BY correct_percentage DESC
        LIMIT 1
      `,
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...rest } = user;

    // Compute statistics
    const { total = 0, completed = 0, avg_score = 0 } = testStats[0] || {};
    const complete_percentage =
      total > 0 ? +((completed / total) * 100).toFixed(2) : 0;
    const correct_percentage = +(+(avg_score ?? 0)).toFixed(2);
    const ranking = rankResult[0]?.rank ?? null;
    const best_topic = topicStats[0]
      ? {
        name: topicStats[0].topic,
        correct_percentage: topicStats[0].correct_percentage,
      }
      : null;

    if (user.type == 'admin') {
      return {
        success: true,
        message: 'Profile fetched successfully',
        data: {
          id: rest.id,
          name: rest.name,
          email: rest.email,
          facebook: rest.facebook,
          linkedin: rest.linkedin,
          twitter_x: rest.twitter_x,
          instagram: rest.instagram,
          join_date: rest.created_at,
          bio: rest.bio,
          avatar: rest.avatar
            ? await SojebStorage.url(
              `${appConfig().storageUrl.avatar}/${rest.avatar}`,
            )
            : null,
        },
      };
    }

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: {
        ...rest,
        avatar: rest.avatar
          ? await SojebStorage.url(
            `${appConfig().storageUrl.avatar}/${rest.avatar}`,
          )
          : null,
        cv: rest.cv
          ? await SojebStorage.url(`${appConfig().storageUrl.cv}/${rest.cv}`)
          : null,
        followings: _count.followings,
        followers: _count.followers,
        statistics: {
          complete_percentage,
          correct_percentage,
          ranking,
          best_topic,
        },
      },
    };
  }

  async reportUser(user_id: string, target_id: string, reason?: string) {
    const report = await this.prisma.report.create({
      data: {
        reporter_id: user_id,
        reported_id: target_id,
        description: reason || null,
      },
    });
    if (!report) throw new HttpException('failed to report user', 400);
    return {
      success: true,
      message: 'Reported successfully',
    };
  }

  async followToggle(user_id: string, target_id: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        following_id_follower_id: {
          follower_id: user_id,
          following_id: target_id,
        },
      },
    });

    if (follow) {
      await this.prisma.follow.delete({
        where: {
          id: follow.id,
        },
      });

      // delete notification
      await this.notificationRepository.deleteNotification({
        sender_id: user_id,
        receiver_id: target_id,
        type: 'follow',
      });

      return {
        success: true,
        message: 'Unfollowed successfully',
      };
    }
    await this.prisma.follow.create({
      data: {
        follower_id: user_id,
        following_id: target_id,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        name: true,
        avatar: true,
      },
    });

    const followNotificationPayload: any = {
      sender_id: user_id,
      receiver_id: target_id,
      message: user?.name + ' Followed you',
      type: 'follow',
    };

    const userSocketId = this.messageGateway.clients.get(target_id);

    if (userSocketId) {
      this.messageGateway.server
        .to(userSocketId)
        .emit('follow', followNotificationPayload);
    }

    await this.notificationRepository.createNotification(
      followNotificationPayload,
    );

    return {
      success: true,
      message: 'Followed successfully',
    };
  }

  async createEducation(
    user_id: string,
    createEducationDto: CreateEducationDto,
    education_id?: string,
  ) {
    const education = await this.prisma.education.upsert({
      where: {
        id: education_id || '',
        user_id,
      },
      update: {
        ...createEducationDto,
      },
      create: {
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
      message: education_id
        ? 'Education updated successfully'
        : 'Education created successfully',
      data: education,
    };
  }

  async createExperience(
    user_id: string,
    createExperienceDto: CreateExperienceDto,
    experience_id?: string,
  ) {
    const experience = await this.prisma.experience.upsert({
      where: {
        id: experience_id || '',
        user_id,
      },
      update: {
        ...createExperienceDto,
      },
      create: {
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
      message: experience_id
        ? 'Experience updated successfully'
        : 'Experience created successfully',
      data: experience,
    };
  }

  async createSkill(
    user_id: string,
    createSkillDto: CreateSkillDto,
    skill_id?: string,
  ) {
    const skill = await this.prisma.skill.upsert({
      where: {
        id: skill_id || '',
        user_id,
      },
      update: {
        ...createSkillDto,
      },
      create: {
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
      message: skill_id
        ? 'Skill updated successfully'
        : 'Skill created successfully',
      data: skill,
    };
  }

  async createPublication(
    user_id: string,
    createPublicationDto: CreatePublicationDto,
    publication_id?: string,
  ) {
    const publication = await this.prisma.publication.upsert({
      where: {
        id: publication_id || '',
        user_id,
      },
      update: {
        ...createPublicationDto,
      },
      create: {
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
      message: publication_id
        ? 'Publication updated successfully'
        : 'Publication created successfully',
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
