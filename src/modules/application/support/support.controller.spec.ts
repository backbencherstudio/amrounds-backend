import { Test, TestingModule } from '@nestjs/testing';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

const mockSupportService = {
  create: jest.fn().mockReturnValue('This action adds a new support'),
  findAll: jest.fn().mockReturnValue('This action returns all support'),
  findOne: jest.fn().mockReturnValue('This action returns a #1 support'),
  update: jest.fn().mockReturnValue('This action updates a #1 support'),
  remove: jest.fn().mockReturnValue('This action removes a #1 support'),
};

describe('SupportController', () => {
  let controller: SupportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [{ provide: SupportService, useValue: mockSupportService }],
    }).compile();

    controller = module.get<SupportController>(SupportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
