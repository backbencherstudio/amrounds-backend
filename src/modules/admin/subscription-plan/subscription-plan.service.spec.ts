import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlanService } from './subscription-plan.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SubscriptionPlanService', () => {
  let service: SubscriptionPlanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        {
          provide: PrismaService,
          useValue: {
            subscriptionPlan: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionPlanService>(SubscriptionPlanService);
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
