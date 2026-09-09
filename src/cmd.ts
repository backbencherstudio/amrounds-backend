// external imports
import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import { ConfigModule } from '@nestjs/config';
// internal imports
import { PrismaService } from './prisma/prisma.service';
import { SeedCommand } from './command/seed.command';
import { UserRepository } from './common/repository/user/user.repository';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
  ],
  providers: [SeedCommand, PrismaService, UserRepository],
})
export class AppModule { }

async function bootstrap() {
  await CommandFactory.run(AppModule);
}

bootstrap();
