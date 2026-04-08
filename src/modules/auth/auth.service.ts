// external imports
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { MailService } from '../../mail/mail.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from '../chat/message/message.gateway';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private userRepository: UserRepository,
    private ucodeRepository: UcodeRepository,
    private notificationRepository: NotificationRepository,
    private messageGateway: MessageGateway,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async createActivity(activityDto: { title?: string; description?: string }) {
    try {
      await this.prisma.activity.create({
        data: activityDto,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          address: true,
          phone_number: true,
          type: true,
          gender: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    avatar?: Express.Multer.File,
  ) {
    const data: any = {};
    if (updateUserDto.name) {
      data.name = updateUserDto.name;
    }
    // if (updateUserDto.first_name) {
    //   data.first_name = updateUserDto.first_name;
    // }
    // if (updateUserDto.last_name) {
    //   data.last_name = updateUserDto.last_name;
    // }
    // if (updateUserDto.phone_number) {
    //   data.phone_number = updateUserDto.phone_number;
    // }
    // if (updateUserDto.country) {
    //   data.country = updateUserDto.country;
    // }
    // if (updateUserDto.state) {
    //   data.state = updateUserDto.state;
    // }
    // if (updateUserDto.local_government) {
    //   data.local_government = updateUserDto.local_government;
    // }
    // if (updateUserDto.city) {
    //   data.city = updateUserDto.city;
    // }
    // if (updateUserDto.zip_code) {
    //   data.zip_code = updateUserDto.zip_code;
    // }
    if (updateUserDto.address) {
      data.address = updateUserDto.address;
    }
    // if (updateUserDto.gender) {
    //   data.gender = updateUserDto.gender;
    // }
    // if (updateUserDto.date_of_birth) {
    //   data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
    // }
    if (updateUserDto.bio) {
      data.bio = updateUserDto.bio;
    }
    if (updateUserDto.instagram) {
      data.instagram = updateUserDto.instagram;
    }
    if (updateUserDto.twitter_x) {
      data.twitter_x = updateUserDto.twitter_x;
    }
    if (updateUserDto.facebook) {
      data.facebook = updateUserDto.facebook;
    }
    if (updateUserDto.linkedin) {
      data.linkedin = updateUserDto.linkedin;
    }

    if (updateUserDto.credentials) {
      data.credentials = updateUserDto.credentials;
    }

    if (updateUserDto.training_practice) {
      data.training_practice = updateUserDto.training_practice;
    }

    if (updateUserDto.current_practice) {
      data.current_practice = updateUserDto.current_practice;
    }
    if (updateUserDto.website_notification) {
      data.website_notification = updateUserDto.website_notification;
    }
    if (updateUserDto.email_notification) {
      data.email_notification = updateUserDto.email_notification;
    }
    if (
      updateUserDto.is_public !== undefined ||
      updateUserDto.is_public !== null
    ) {
      data.is_public = updateUserDto.is_public;
    }
    if (updateUserDto.password) {
      data.password = await this.changePassword({
        user_id: userId,
        oldPassword: updateUserDto.password,
        newPassword: updateUserDto.new_password,
      });
    }

    if (avatar) {
      // delete old image from storage
      const oldImage = await this.prisma.user.findFirst({
        where: { id: userId },
        select: { avatar: true },
      });
      if (oldImage.avatar) {
        await SojebStorage.delete(
          appConfig().storageUrl.avatar + '/' + oldImage.avatar,
        );
      }

      // upload file
      const fileName = `${StringHelper.randomString()}${avatar.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.avatar + fileName,
        avatar.buffer,
      );

      data.avatar = fileName;
    }
    const user = await this.userRepository.getUserDetails(userId);
    if (user) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
        },
      });

      return {
        success: true,
        message: 'User updated successfully',
      };
    } else {
      return {
        success: false,
        message: 'User not found',
      };
    }
  }

  async validateUser(
    email: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      if (user.type != 'admin') {
        if (user.rejected) {
          throw new UnauthorizedException(
            'Your account has been rejected, please contact support',
          );
        }
        // if (user.status == 0 || user.email_verified_at == null) {
        //   throw new UnauthorizedException('User not verified');
        // }
        if (user.approved_at == null || !user.approved) {
          throw new UnauthorizedException(
            'User not approved! Please wait for approval',
          );
        }
      }
      const _isValidPassword = await this.userRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await this.userRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
              // return {
              //   success: false,
              //   message: 'Invalid token',
              // };
            }
          } else {
            throw new UnauthorizedException('Token is required');
            // return {
            //   success: false,
            //   message: 'Token is required',
            // };
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
        // return {
        //   success: false,
        //   message: 'Password not matched',
        // };
      }
    } else {
      throw new UnauthorizedException('Email not found');
      // return {
      //   success: false,
      //   message: 'Email not found',
      // };
    }
  }

  async login({ email, userId }) {
    try {
      const payload = { email: email, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await this.userRepository.getUserDetails(userId);

      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await this.userRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async register({
    name,
    email,
    password,
    credentials,
    training_practice,
    address,
    current_practice,
    bio,
    instagram,
    linkedin,
    twitter_x,
    facebook,
    type,
    avatar,
    verification_doc,
  }: {
    name: string;
    email: string;
    password: string;
    credentials: string;
    training_practice: string;
    address: string;
    current_practice?: string;
    bio?: string;
    instagram?: string;
    linkedin?: string;
    twitter_x?: string;
    facebook?: string;
    type?: string;
    avatar: Express.Multer.File;
    verification_doc?: Express.Multer.File;
  }) {
    try {
      // Check if email already exist
      const userEmailExist = await this.userRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          statusCode: 401,
          message: 'Email already exists',
        };
      }

      // upload avatar
      const avatarName = `${StringHelper.randomString()}${avatar.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.avatar + '/' + avatarName,
        avatar.buffer,
      );

      // upload verification doc
      let verificationDocName = null;
      if (verification_doc) {
        verificationDocName = `${StringHelper.randomString()}${
          verification_doc.originalname
        }`;
        await SojebStorage.put(
          appConfig().storageUrl.verification_doc + '/' + verificationDocName,
          verification_doc.buffer,
        );
      }

      const user = await this.userRepository.createUser({
        name: name,
        email: email,
        password: password,
        credentials: credentials,
        training_practice: training_practice,
        address: address,
        current_practice: current_practice,
        bio: bio,
        instagram: instagram,
        linkedin: linkedin,
        twitter_x: twitter_x,
        facebook: facebook,
        type: type,
        avatar: avatarName,
        verifiy_document: verificationDocName,
      });

      if (user == null && user.success == false) {
        await this.createActivity({
          title: 'User registration failed',
          description: `User ${name} registration failed`,
        });
        return {
          success: false,
          message: 'Failed to create account',
        };
      }

      // admin notification for approve
      const admins = await this.prisma.user.findMany({
        where: {
          type: 'admin',
        },
        select: {
          id: true,
        },
      });

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          const registerNotificationPayload: any = {
            sender_id: null,
            receiver_id: admin.id,
            text: `Register a new user ${name}. Please approve it.`,
            type: 'user_registered',
          };

          await this.notificationRepository.createNotification(
            registerNotificationPayload,
          );

          const adminSocketId = await this.messageGateway.clients.get(admin.id);
          if (adminSocketId) {
            this.messageGateway.server
              .to(adminSocketId)
              .emit('user_registered', registerNotificationPayload);
          }
        }
      }

      // create stripe customer account
      // const stripeCustomer = await StripePayment.createCustomer({
      //   user_id: user.data.id,
      //   email: email,
      //   name: name,
      // });

      // if (stripeCustomer) {
      //   await this.prisma.user.update({
      //     where: {
      //       id: user.data.id,
      //     },
      //     data: {
      //       billing_id: stripeCustomer.id,
      //     },
      //   });
      // }

      // ----------------------------------------------------
      // // create otp code
      // const token = await this.ucodeRepository.createToken({
      //   userId: user.data.id,
      //   isOtp: true,
      // });

      // // send otp code to email
      // await this.mailService.sendOtpCodeToEmail({
      //   email: email,
      //   name: name,
      //   otp: token,
      // });

      // return {
      //   success: true,
      //   message: 'We have sent an OTP code to your email',
      // };

      // ----------------------------------------------------

      // Generate verification token
      const token = await this.ucodeRepository.createVerificationToken({
        userId: user.data.id,
        email: email,
      });

      // Send verification email with token
      await this.mailService.sendVerificationLink({
        email,
        name: email,
        token: token.token,
        type: type,
      });

      await this.createActivity({
        title: 'User registered',
        description: `User ${name} registered`,
      });

      return {
        success: true,
        message: 'We have sent a verification link to your email',
      };
    } catch (error) {
      await this.createActivity({
        title: 'User registration failed',
        description: `User ${name} registration failed`,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async forgotPassword(email) {
    try {
      const user = await this.userRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await this.ucodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resetPassword({ email, token, password }) {
    try {
      const user = await this.userRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await this.ucodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.userRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await this.ucodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail({ email, token }) {
    try {
      const user = await this.userRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await this.ucodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          // await this.ucodeRepository.deleteToken({
          //   email: email,
          //   token: token,
          // });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await this.userRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await this.ucodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await this.userRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await this.userRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        const token = await this.ucodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await this.ucodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await this.userRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await this.ucodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await this.userRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await this.userRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        await this.userRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await this.userRepository.getUserDetails(user_id);
      if (user) {
        await this.userRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------
}
