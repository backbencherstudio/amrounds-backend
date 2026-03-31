import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { StatisticService } from './statistic.service';
import { Request } from 'express';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
@Controller('statistic')
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}
  @Get()
  getStatistics(@Req() req: Request) {
    return this.statisticService.getStatistics(req?.user?.userId);
  }

  @Get('/:id')
  getStatisticsById(@Param('id') id: string) {
    return this.statisticService.getStatistics(id);
  }
}
