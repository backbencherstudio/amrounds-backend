import { Test, TestingModule } from '@nestjs/testing';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';

describe('StripeController', () => {
  let controller: StripeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [
        StripeService,
        {
          provide: TransactionRepository,
          useValue: {
            updateTransaction: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            plan: { findUnique: jest.fn() },
            user: { findUnique: jest.fn(), update: jest.fn() },
            subscription: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
            paymentTransaction: { create: jest.fn() },
          },
        },
      ],
    }).compile();

    controller = module.get<StripeController>(StripeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
