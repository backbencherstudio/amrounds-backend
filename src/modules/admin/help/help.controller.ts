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
import { HelpService } from './help.service';
import { CreateHelpDto } from './dto/create-help.dto';
import { UpdateHelpDto } from './dto/update-help.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Role } from 'src/common/guard/role/role.enum';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Help')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@Controller('admin/help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Patch()
  createSupport(@Req() req: Request, @Body() createHelpDto: CreateHelpDto) {
    const userId = req.user.userId;
    return this.helpService.createSupport(userId, createHelpDto);
  }

  @Get()
  findAllSupport() {
    return this.helpService.findAllSupport();
  }

  @Delete(':id')
  deleteSupport(@Param('id') id: string) {
    return this.helpService.deleteSupport(id);
  }
}
