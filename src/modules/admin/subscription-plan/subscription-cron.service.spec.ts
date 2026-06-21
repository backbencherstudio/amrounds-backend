import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionCronService } from './subscription-cron.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('SubscriptionCronService', () => {
  let service: SubscriptionCronService;
  let prisma: PrismaService;

  const mockPrismaService = {
    subscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCronService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionCronService>(SubscriptionCronService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleSubscriptionExpiration', () => {
    it('should find expired subscriptions and update them to expired status', async () => {
      const expiredSubs = [
        { id: 'sub-1', status: 'active', plan_type: 'MONTHLY' },
        { id: 'sub-2', status: 'active', plan_type: 'PAY_AS_YOU_GO', remaining_credits: 0 },
      ];

      mockPrismaService.subscription.findMany.mockResolvedValue(expiredSubs);
      mockPrismaService.subscription.updateMany.mockResolvedValue({ count: 2 });

      await service.handleSubscriptionExpiration();

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          OR: [
            {
              plan_type: 'MONTHLY',
              current_period_end: {
                lt: expect.any(Date),
              },
            },
            {
              plan_type: 'PAY_AS_YOU_GO',
              remaining_credits: {
                lte: 0,
              },
            },
          ],
        },
      });

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['sub-1', 'sub-2'],
          },
        },
        data: {
          status: 'expired',
        },
      });
    });

    it('should not perform updates if no expired subscriptions are found', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      await service.handleSubscriptionExpiration();

      expect(prisma.subscription.findMany).toHaveBeenCalled();
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('should catch errors and not crash the application', async () => {
      const errorMsg = 'DB Error';
      mockPrismaService.subscription.findMany.mockRejectedValue(new Error(errorMsg));

      // This should run successfully without throwing since errors are caught internally
      await expect(service.handleSubscriptionExpiration()).resolves.not.toThrow();
    });
  });
});
