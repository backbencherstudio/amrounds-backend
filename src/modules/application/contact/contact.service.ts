import { Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto/create-contact.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { Role } from 'src/common/guard/role/role.enum';
import appConfig from 'src/config/app.config';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(createContactDto: CreateContactDto) {
    const contact = await this.prisma.contact.create({
      data: {
        name: createContactDto.name,
        first_name: createContactDto.first_name,
        last_name: createContactDto.last_name,
        email: createContactDto.email,
        phone_number: createContactDto.phone_number,
        message: createContactDto.message,
      },
    });

    // Send email to the configured admin email
    const adminEmail = appConfig().mail.from;
    const emailSubject = `New Contact Message from ${createContactDto.name || 'Visitor'}`;

    try {
      const contactInfo = {
        name:
          createContactDto.name ||
          `${createContactDto.first_name || ''} ${createContactDto.last_name || ''}`.trim(),
        email: createContactDto.email,
        subject: emailSubject,
        message: createContactDto.message,
      };

      if (adminEmail) {
        await this.mailService.sendContactNotification({
          adminEmail: adminEmail,
          contact: contactInfo,
        });
      }

      // Also send to all database admins if any
      const admins = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              name: Role.ADMIN,
            },
          },
        },
        select: { email: true },
      });

      for (const admin of admins) {
        if (admin.email && admin.email !== adminEmail) {
          await this.mailService.sendContactNotification({
            adminEmail: admin.email,
            contact: contactInfo,
          });
        }
      }
    } catch (error) {
      console.log(error);
    }

    return {
      success: true,
      message: 'Submitted successfully',
    };
  }
}
