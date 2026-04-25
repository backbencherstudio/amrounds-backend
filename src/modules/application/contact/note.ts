// import { Injectable } from '@nestjs/common';
// import { CreateContactDto } from './dto/create-contact.dto';
// import { PrismaService } from '../../../prisma/prisma.service';
// import { MailService } from 'src/mail/mail.service';
// import { Role } from 'src/common/guard/role/role.enum';
// import appConfig from 'src/config/app.config';

// @Injectable()
// export class ContactService {
//   constructor(
//     private prisma: PrismaService,
//     private mailService: MailService,
//   ) {}

//   async create(createContactDto: CreateContactDto) {
//     const data: any = {};
//     if (createContactDto.name) {
//       data['name'] = createContactDto.name;
//     }
//     if (createContactDto.first_name) {
//       data['first_name'] = createContactDto.first_name;
//     }
//     if (createContactDto.last_name) {
//       data['last_name'] = createContactDto.last_name;
//     }
//     if (createContactDto.email) {
//       data['email'] = createContactDto.email;
//     }
//     if (createContactDto.phone_number) {
//       data['phone_number'] = createContactDto.phone_number;
//     }
//     if (createContactDto.message) {
//       data['message'] = createContactDto.message;
//     }
//     const contact = await this.prisma.contact.create({
//       data,
//     });

//     // Default subject for email
//     const subject = `New Contact Message`;

//     // Send email to the configured admin email
//     const adminEmail = appConfig().mail.from;

//     try {
//       if (adminEmail) {
//         await this.mailService.sendContactNotification({
//           adminEmail: adminEmail,
//           contact: {
//             name: data.name || `${data.first_name} ${data.last_name}`,
//             email: data.email,
//             subject: subject,
//             message: data.message,
//           },
//         });
//       }

//       // Also send to all database admins if any
//       const admins = await this.prisma.user.findMany({
//         where: {
//           roles: {
//             some: {
//               name: Role.ADMIN,
//             },
//           },
//         },
//         select: { email: true },
//       });

//       for (const admin of admins) {
//         if (admin.email && admin.email !== adminEmail) {
//           await this.mailService.sendContactNotification({
//             adminEmail: admin.email,
//             contact: {
//               name: data.name || `${data.first_name} ${data.last_name}`,
//               email: data.email,
//               subject: subject,
//               message: data.message,
//             },
//           });
//         }
//       }
//     } catch (error) {
//       console.log(error);
//     }

//     return {
//       success: true,
//       message: 'Submitted successfully',
//     };
//   }
// }
