import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
