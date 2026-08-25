import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpecialityDto, CreateTopicDto } from './dto/create-speciality.dto';
import {
  AddTopicDto,
  UpdateSpecialityDto,
  UpdateTopicDto,
} from './dto/update-speciality.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';

@Injectable()
export class SpecialityService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Helper to resolve full image URL from storage or preserve external URL
   */
  private async getFileUrl(pathOrFileName?: string | null): Promise<string | null> {
    if (!pathOrFileName) return null;
    if (pathOrFileName.startsWith('http://') || pathOrFileName.startsWith('https://')) {
      return pathOrFileName;
    }
    try {
      return await SojebStorage.url(
        `${appConfig().storageUrl.speciality}/${pathOrFileName}`,
      );
    } catch {
      return pathOrFileName;
    }
  }

  /**
   * Format a speciality record with resolved image URLs for itself and topics
   */
  private async formatSpeciality(speciality: any) {
    if (!speciality) return null;

    const formatted = {
      ...speciality,
      image_url: await this.getFileUrl(speciality.image_url),
    };

    if (Array.isArray(speciality.topics)) {
      formatted.topics = await Promise.all(
        speciality.topics.map(async (topic: any) => ({
          ...topic,
          image_url: await this.getFileUrl(topic.image_url),
        })),
      );
    }

    return formatted;
  }

  /**
   * Extract and match uploaded files to speciality and topics
   */
  private matchUploadedFiles(
    files: Array<Express.Multer.File> = [],
    topicsCount: number = 0,
  ) {
    let specialityImageFile: Express.Multer.File | undefined;
    const topicFilesMap = new Map<number, Express.Multer.File>();
    const generalTopicFiles: Express.Multer.File[] = [];

    for (const file of files) {
      const fn = file.fieldname;

      // 1. Explicit speciality image fields
      if (
        ['image', 'speciality_image', 'specialityImage', 'speciality_file', 'cover_image'].includes(
          fn,
        )
      ) {
        if (!specialityImageFile) {
          specialityImageFile = file;
          continue;
        }
      }

      // 2. Indexed topic image field patterns (e.g., topics[0][image], topic_image_0, topic_images[0], topics_0_image)
      const indexedMatch = fn.match(
        /^(?:topics\[(\d+)\](?:\[(?:image|file|image_url)\])?|topic_image_(\d+)|topic_images\[(\d+)\]|topics_(\d+)_image|topic_(\d+))$/i,
      );
      if (indexedMatch) {
        const rawIdx =
          indexedMatch[1] ||
          indexedMatch[2] ||
          indexedMatch[3] ||
          indexedMatch[4] ||
          indexedMatch[5];
        const idx = parseInt(rawIdx, 10);
        if (!isNaN(idx)) {
          topicFilesMap.set(idx, file);
          continue;
        }
      }

      // 3. General topic image array fields (e.g. topic_images, topic_image, topicImages)
      if (['topic_images', 'topic_image', 'topicImages', 'topics'].includes(fn)) {
        generalTopicFiles.push(file);
        continue;
      }

      // 4. Fallback: first unassigned file becomes speciality image if not set
      if (!specialityImageFile) {
        specialityImageFile = file;
      } else {
        generalTopicFiles.push(file);
      }
    }

    return { specialityImageFile, topicFilesMap, generalTopicFiles };
  }

  /**
   * Upload an image buffer to SojebStorage
   */
  private async uploadImage(
    file: Express.Multer.File,
    uploadedTracker: string[],
  ): Promise<string> {
    try {
      const randomStr = StringHelper.randomString(8);
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${randomStr}_${sanitizedOriginalName}`;

      await SojebStorage.put(
        `${appConfig().storageUrl.speciality}/${fileName}`,
        file.buffer,
      );

      uploadedTracker.push(fileName);
      return fileName;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload image (${file.originalname}): ${error.message}`,
      );
    }
  }

  /**
   * Delete uploaded files in case of rollback
   */
  private async cleanupUploadedFiles(fileNames: string[]) {
    for (const fileName of fileNames) {
      try {
        await SojebStorage.delete(
          `${appConfig().storageUrl.speciality}/${fileName}`,
        );
      } catch (err) {
        console.error(`Failed to cleanup file ${fileName}:`, err);
      }
    }
  }

  /**
   * Create Speciality with cover image and multiple topics with images
   */
  async create(
    createSpecialityDto: CreateSpecialityDto,
    files?: Array<Express.Multer.File>,
  ) {
    const uploadedTracker: string[] = [];

    try {
      const { name, is_active, topics = [] } = createSpecialityDto;

      if (!name || name.trim() === '') {
        throw new BadRequestException('Speciality name is required');
      }

      // Match files
      const { specialityImageFile, topicFilesMap, generalTopicFiles } =
        this.matchUploadedFiles(files, topics.length);

      // Resolve speciality image
      let specialityImageName: string | undefined = createSpecialityDto.image_url;
      if (specialityImageFile) {
        specialityImageName = await this.uploadImage(
          specialityImageFile,
          uploadedTracker,
        );
      }

      if (!specialityImageName) {
        throw new BadRequestException(
          'Speciality image is required (upload as "image" file or provide "image_url")',
        );
      }

      // Process topics
      const parsedTopics: CreateTopicDto[] = Array.isArray(topics) ? topics : [];

      // Check unique topic names inside the request
      const topicNameSet = new Set<string>();
      for (const topic of parsedTopics) {
        const normalizedName = topic.name?.trim().toLowerCase();
        if (!normalizedName) {
          throw new BadRequestException('All topics must have a valid name');
        }
        if (topicNameSet.has(normalizedName)) {
          throw new BadRequestException(
            `Duplicate topic name "${topic.name}" in request`,
          );
        }
        topicNameSet.add(normalizedName);
      }

      // Resolve topic images
      const preparedTopics: Array<{
        name: string;
        image_url: string;
        is_active: boolean;
      }> = [];

      for (let i = 0; i < parsedTopics.length; i++) {
        const topicDto = parsedTopics[i];
        let topicFile = topicFilesMap.get(i);

        if (!topicFile && typeof topicDto.image_index === 'number') {
          topicFile = topicFilesMap.get(topicDto.image_index);
        }

        if (!topicFile && generalTopicFiles.length > 0) {
          topicFile = generalTopicFiles.shift();
        }

        let topicImageName: string | undefined = topicDto.image_url;
        if (topicFile) {
          topicImageName = await this.uploadImage(topicFile, uploadedTracker);
        }

        if (!topicImageName) {
          throw new BadRequestException(
            `Image for topic "${topicDto.name}" is required (upload in "topic_images" or provide "image_url")`,
          );
        }

        preparedTopics.push({
          name: topicDto.name.trim(),
          image_url: topicImageName,
          is_active: topicDto.is_active ?? true,
        });
      }

      // Check if speciality name already exists
      const existingSpeciality = await this.prisma.speciality.findFirst({
        where: {
          name: {
            equals: name.trim(),
            mode: 'insensitive',
          },
        },
      });

      if (existingSpeciality) {
        throw new BadRequestException(
          `Speciality with name "${name.trim()}" already exists`,
        );
      }

      // Persist to database
      await this.prisma.speciality.create({
        data: {
          name: name.trim(),
          image_url: specialityImageName!,
          is_active: is_active ?? true,
          topics:
            preparedTopics.length > 0
              ? {
                create: preparedTopics.map((topic) => ({
                  name: topic.name,
                  image_url: topic.image_url,
                  is_active: topic.is_active,
                })),
              }
              : undefined,
        },
      });

      return {
        success: true,
        message: 'Speciality created successfully',
      };
    } catch (error) {
      // Rollback uploaded files in storage on failure
      if (uploadedTracker.length > 0) {
        await this.cleanupUploadedFiles(uploadedTracker);
      }

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      console.error('Speciality creation error:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to create speciality',
      );
    }
  }

  /**
   * Get all specialities
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: string | boolean;
  }) {
    try {
      const page = query?.page ? Number(query.page) : 1;
      const limit = query?.limit ? Number(query.limit) : 50;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (query?.search) {
        where.name = { contains: query.search, mode: 'insensitive' };
      }

      if (query?.is_active !== undefined) {
        const isActiveBool =
          query.is_active === 'true' ||
          query.is_active === true ||
          query.is_active === '1';
        where.is_active = isActiveBool;
      }

      const [specialities, total] = await this.prisma.$transaction([
        this.prisma.speciality.findMany({
          where,
          skip,
          take: limit,
          // orderBy: { created_at: 'desc' },
          select: {
            id: true,
            name: true,
            is_active: true,
            created_at: true,
            updated_at: true,
          },
        }),
        this.prisma.speciality.count({ where }),
      ]);

      const totalPage = Math.ceil(total / limit);

      return {
        success: true,
        message: 'Specialities fetched successfully',
        data: specialities,
        meta: {
          total,
          page,
          limit,
          totalPage,
          next: page < totalPage ? page + 1 : null,
          previous: page > 1 ? page - 1 : null,
        },
      };
    } catch (error) {
      console.error('Failed to fetch specialities:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch specialities',
      );
    }
  }

  /**
   * Get single speciality by ID
   */
  async findOne(id: string) {
    try {
      const speciality = await this.prisma.speciality.findUnique({
        where: { id },
        include: {
          topics: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      if (!speciality) {
        throw new NotFoundException(`Speciality with ID "${id}" not found`);
      }

      const formattedData = await this.formatSpeciality(speciality);

      return {
        success: true,
        message: 'Speciality fetched successfully',
        data: formattedData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch speciality',
      );
    }
  }

  /**
   * Update speciality fields individually or together
   */
  async update(
    id: string,
    updateSpecialityDto: UpdateSpecialityDto,
    files?: Array<Express.Multer.File>,
  ) {
    const uploadedTracker: string[] = [];

    try {
      const existing = await this.prisma.speciality.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Speciality with ID "${id}" not found`);
      }

      const { name, is_active } = updateSpecialityDto;
      const dataToUpdate: any = {};

      // 1. Update Name (if provided, check uniqueness against other records)
      if (name !== undefined && name.trim() !== '') {
        const trimmedName = name.trim();
        if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
          const nameConflict = await this.prisma.speciality.findFirst({
            where: {
              name: {
                equals: trimmedName,
                mode: 'insensitive',
              },
              id: {
                not: id,
              },
            },
          });

          if (nameConflict) {
            throw new BadRequestException(
              `Speciality with name "${trimmedName}" already exists`,
            );
          }
        }
        dataToUpdate.name = trimmedName;
      }

      // 2. Update is_active (if provided)
      if (is_active !== undefined) {
        dataToUpdate.is_active = is_active;
      }

      // 3. Update Image (if new file uploaded or new URL provided)
      const { specialityImageFile } = this.matchUploadedFiles(files);

      if (specialityImageFile) {
        const newImageName = await this.uploadImage(
          specialityImageFile,
          uploadedTracker,
        );
        dataToUpdate.image_url = newImageName;

        // Clean up old image if it was stored locally/s3
        if (
          existing.image_url &&
          !existing.image_url.startsWith('http://') &&
          !existing.image_url.startsWith('https://')
        ) {
          try {
            await SojebStorage.delete(
              `${appConfig().storageUrl.speciality}/${existing.image_url}`,
            );
          } catch (e) {
            console.error('Failed to delete old image:', e);
          }
        }
      } else if (updateSpecialityDto.image_url !== undefined && updateSpecialityDto.image_url.trim() !== '') {
        dataToUpdate.image_url = updateSpecialityDto.image_url.trim();
      }

      // If nothing to update, return success message
      if (Object.keys(dataToUpdate).length === 0) {
        return {
          success: true,
          message: 'No fields were updated',
        };
      }

      await this.prisma.speciality.update({
        where: { id },
        data: dataToUpdate,
      });

      return {
        success: true,
        message: 'Speciality updated successfully',
      };
    } catch (error) {
      if (uploadedTracker.length > 0) {
        await this.cleanupUploadedFiles(uploadedTracker);
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to update speciality',
      );
    }
  }

  /**
   * Delete speciality and its images
   */
  async remove(id: string) {
    try {
      const existing = await this.prisma.speciality.findUnique({
        where: { id },
        include: { topics: true },
      });

      if (!existing) {
        throw new NotFoundException(`Speciality with ID "${id}" not found`);
      }

      // Delete images from storage
      if (
        existing.image_url &&
        !existing.image_url.startsWith('http://') &&
        !existing.image_url.startsWith('https://')
      ) {
        try {
          await SojebStorage.delete(
            `${appConfig().storageUrl.speciality}/${existing.image_url}`,
          );
        } catch (e) {
          console.error('Failed to delete speciality image:', e);
        }
      }

      for (const topic of existing.topics) {
        if (
          topic.image_url &&
          !topic.image_url.startsWith('http://') &&
          !topic.image_url.startsWith('https://')
        ) {
          try {
            await SojebStorage.delete(
              `${appConfig().storageUrl.speciality}/${topic.image_url}`,
            );
          } catch (e) {
            console.error('Failed to delete topic image:', e);
          }
        }
      }

      await this.prisma.speciality.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Speciality and its topics deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error.message || 'Failed to delete speciality',
      );
    }
  }

  /**
   * Add a new topic to a specific speciality
   */
  async addTopic(
    specialityId: string,
    addTopicDto: AddTopicDto,
    files?: Array<Express.Multer.File>,
  ) {
    const uploadedTracker: string[] = [];

    try {
      const speciality = await this.prisma.speciality.findUnique({
        where: { id: specialityId },
      });

      if (!speciality) {
        throw new NotFoundException(
          `Speciality with ID "${specialityId}" not found`,
        );
      }

      const { name, is_active } = addTopicDto;
      if (!name || name.trim() === '') {
        throw new BadRequestException('Topic name is required');
      }

      const trimmedName = name.trim();

      // Check if topic with same name exists under this speciality
      const existingTopic = await this.prisma.topics.findFirst({
        where: {
          speciality_id: specialityId,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
        },
      });

      if (existingTopic) {
        throw new BadRequestException(
          `Topic with name "${trimmedName}" already exists in this speciality`,
        );
      }

      // Resolve topic image
      let topicImageName: string | undefined = addTopicDto.image_url;
      const topicImageFile = files?.[0];

      if (topicImageFile) {
        topicImageName = await this.uploadImage(
          topicImageFile,
          uploadedTracker,
        );
      }

      if (!topicImageName) {
        throw new BadRequestException(
          'Topic image is required (upload as "image" file or provide "image_url")',
        );
      }

      await this.prisma.topics.create({
        data: {
          name: trimmedName,
          image_url: topicImageName,
          is_active: is_active ?? true,
          speciality_id: specialityId,
        },
      });

      return {
        success: true,
        message: 'Topic added successfully',
      };
    } catch (error) {
      if (uploadedTracker.length > 0) {
        await this.cleanupUploadedFiles(uploadedTracker);
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Add topic error:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to add topic',
      );
    }
  }

  /**
   * Delete a topic by topicId (and optionally verify specialityId)
   */
  async deleteTopic(topicId: string) {
    try {
      const whereClause: any = { id: topicId };
      // if (specialityId) {
      //   whereClause.speciality_id = specialityId;
      // }

      const topic = await this.prisma.topics.findFirst({
        where: whereClause,
      });

      if (!topic) {
        throw new NotFoundException(`Topic with ID "${topicId}" not found`);
      }

      // Clean up topic image from storage
      if (
        topic.image_url &&
        !topic.image_url.startsWith('http://') &&
        !topic.image_url.startsWith('https://')
      ) {
        try {
          await SojebStorage.delete(
            `${appConfig().storageUrl.speciality}/${topic.image_url}`,
          );
        } catch (err) {
          console.error('Failed to delete topic image:', err);
        }
      }

      await this.prisma.topics.delete({
        where: { id: topicId },
      });

      return {
        success: true,
        message: 'Topic deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error.message || 'Failed to delete topic',
      );
    }
  }

  /**
   * Update a specific topic (name, is_active, or image)
   */
  async updateTopic(
    topicId: string,
    updateTopicDto: UpdateTopicDto,
    files?: Array<Express.Multer.File>,
  ) {
    const uploadedTracker: string[] = [];

    try {
      const existing = await this.prisma.topics.findUnique({
        where: { id: topicId },
      });

      if (!existing) {
        throw new NotFoundException(`Topic with ID "${topicId}" not found`);
      }

      const { name, is_active } = updateTopicDto;
      const dataToUpdate: any = {};

      if (name !== undefined && name.trim() !== '') {
        const trimmedName = name.trim();
        if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
          const nameConflict = await this.prisma.topics.findFirst({
            where: {
              speciality_id: existing.speciality_id,
              name: {
                equals: trimmedName,
                mode: 'insensitive',
              },
              id: {
                not: topicId,
              },
            },
          });

          if (nameConflict) {
            throw new BadRequestException(
              `Topic with name "${trimmedName}" already exists in this speciality`,
            );
          }
        }
        dataToUpdate.name = trimmedName;
      }

      if (is_active !== undefined) {
        dataToUpdate.is_active = is_active;
      }

      const topicImageFile = files?.[0];
      if (topicImageFile) {
        const newImageName = await this.uploadImage(
          topicImageFile,
          uploadedTracker,
        );
        dataToUpdate.image_url = newImageName;

        if (
          existing.image_url &&
          !existing.image_url.startsWith('http://') &&
          !existing.image_url.startsWith('https://')
        ) {
          try {
            await SojebStorage.delete(
              `${appConfig().storageUrl.speciality}/${existing.image_url}`,
            );
          } catch (e) {
            console.error('Failed to delete old topic image:', e);
          }
        }
      } else if (updateTopicDto.image_url !== undefined && updateTopicDto.image_url.trim() !== '') {
        dataToUpdate.image_url = updateTopicDto.image_url.trim();
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return {
          success: true,
          message: 'No fields were updated',
        };
      }

      await this.prisma.topics.update({
        where: { id: topicId },
        data: dataToUpdate,
      });

      return {
        success: true,
        message: 'Topic updated successfully',
      };
    } catch (error) {
      if (uploadedTracker.length > 0) {
        await this.cleanupUploadedFiles(uploadedTracker);
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Failed to update topic',
      );
    }
  }
}


