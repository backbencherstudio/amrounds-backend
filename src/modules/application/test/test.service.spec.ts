import { Test, TestingModule } from '@nestjs/testing';
import { TestService } from './test.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('TestService', () => {
  let service: TestService;
  let prisma: PrismaService;

  const mockPrismaService = {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    questions: {
      findMany: jest.fn(),
    },
    test: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TestService>(TestService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOneTest', () => {
    const userId = 'user-1';
    const createTestDto = {
      total_questions: 5,
      test_mode: ['UNUSED'],
      difficulty: ['Intern'],
      topic: ['Cancer'],
    };

    beforeEach(() => {
      mockPrismaService.test.aggregate.mockResolvedValue({
        _sum: { total_questions: 0 },
      });
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);
      mockPrismaService.questions.findMany.mockResolvedValue([
        { id: 'q-1' }, { id: 'q-2' }, { id: 'q-3' }, { id: 'q-4' }, { id: 'q-5' }
      ]);
      mockPrismaService.test.create.mockResolvedValue({
        id: 'test-1',
        total_questions: 5,
      });
    });

    it('should create test under free limit (no subscription)', async () => {
      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(prisma.test.create).toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should block test creation if it exceeds the 100 free questions limit', async () => {
      mockPrismaService.test.aggregate.mockResolvedValue({
        _sum: { total_questions: 98 },
      });
      
      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('free limit of 100 questions');
      expect(prisma.test.create).not.toHaveBeenCalled();
    });

    it('should bypass free limit check with active MONTHLY subscription', async () => {
      mockPrismaService.test.aggregate.mockResolvedValue({
        _sum: { total_questions: 98 },
      });
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        plan_type: 'MONTHLY',
      });

      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(true);
      expect(prisma.test.create).toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should deduct credits for active PAY_AS_YOU_GO subscription', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        plan_type: 'PAY_AS_YOU_GO',
        remaining_credits: 10,
      });

      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(true);
      expect(prisma.test.create).toHaveBeenCalled();
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          remaining_credits: 5,
          status: 'active',
        },
      });
    });

    it('should expire active PAY_AS_YOU_GO subscription if credits reach 0', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        plan_type: 'PAY_AS_YOU_GO',
        remaining_credits: 5,
      });

      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(true);
      expect(prisma.test.create).toHaveBeenCalled();
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          remaining_credits: 0,
          status: 'expired',
        },
      });
    });

    it('should block test creation if active PAY_AS_YOU_GO subscription has 0 remaining credits', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        plan_type: 'PAY_AS_YOU_GO',
        remaining_credits: 0,
      });

      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('run out of credits');
      expect(prisma.test.create).not.toHaveBeenCalled();
    });

    it('should block test creation if active PAY_AS_YOU_GO subscription does not have enough credits', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
        plan_type: 'PAY_AS_YOU_GO',
        remaining_credits: 3,
      });

      const result = await service.createOneTest(userId, createTestDto as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not have enough credits');
      expect(prisma.test.create).not.toHaveBeenCalled();
    });
  });
});
