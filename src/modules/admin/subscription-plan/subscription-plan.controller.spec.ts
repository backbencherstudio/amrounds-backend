import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlanController } from './subscription-plan.controller';
import { SubscriptionPlanService } from './subscription-plan.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

describe('SubscriptionPlanController', () => {
  let controller: SubscriptionPlanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionPlanController],
      providers: [
        {
          provide: SubscriptionPlanService,
          useValue: {
            createPlan: jest.fn(),
            findAllPlans: jest.fn(),
            findAllBillingHistory: jest.fn(),
            findOnePlan: jest.fn(),
            updatePlan: jest.fn(),
            removePlan: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubscriptionPlanController>(SubscriptionPlanController);
  });


  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
