import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';
import { GetLeaderboardDto } from './dto/query-leaderboard.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  getLeaderboard(@Query() query: GetLeaderboardDto, @Req() req: any) {
    const targetUserId = query.user_id || req?.user?.userId;

    return this.leaderboardService.getLeaderboard(targetUserId, query);
  }
  @Get('map-data')
  getMapData() {
    return this.leaderboardService.getMapData();
  }
}
