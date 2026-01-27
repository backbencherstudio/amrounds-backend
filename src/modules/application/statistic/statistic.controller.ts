import { Controller, Get, Req } from '@nestjs/common';
import { StatisticService } from './statistic.service';
import { Request } from 'express';

@Controller('statistic')
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}
  @Get()
  getStatistics(@Req() req: Request) {
    return this.statisticService.getStatistics(req?.user?.userId);
  }
}
