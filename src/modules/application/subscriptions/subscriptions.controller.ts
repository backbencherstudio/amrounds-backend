import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';


@ApiTags('User Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) { }


  @Get()
  findAllPlans() {
    return this.subscriptionsService.findAllPlans();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get('my-subscription')
  mySubscription(@Req() req: any) {
    const user_id = req.user.userId;
    console.log(user_id)
    return this.subscriptionsService.mySubscription(user_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get('my-active-subscription')
  myActiveSubscription(@Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.myActiveSubscription(user_id);
  }


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Patch('cancel-subscription')
  cancelSubscription(@Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.cancelSubscription(user_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Patch('change-plan')
  changeSubscriptionPlan(@Req() req: any, @Body('plan_id') plan_id: string) {
    const user_id = req.user.userId;
    return this.subscriptionsService.changeSubscriptionPlan(user_id, plan_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get(':id')
  findOnePlan(@Param('id') id: string) {
    return this.subscriptionsService.findOnePlan(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Post(':id')
  buySubscription(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.buySubscription(id, user_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  @Get('biling/history')
  allBilingHistory(@Req() req: any) {
    const user_id = req.user.userId;
    return this.subscriptionsService.allBilingHistory(user_id);
  }
}
