import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminUser } from '@prisma/client';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { ReorderSkillsDto } from './dto/reorder-skills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  // Declared BEFORE :id so "grouped" isn't treated as an id.
  @Get('grouped')
  @ApiOperation({ summary: 'Skills grouped by category (group + label + skills)' })
  async findAllGrouped() {
    return { data: await this.skillsService.findAllGrouped() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a skill by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.skillsService.findOne(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a skill' })
  async create(
    @Body() dto: CreateSkillDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.skillsService.create(dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder skills' })
  async reorder(
    @Body() dto: ReorderSkillsDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.skillsService.reorder(dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a skill by ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.skillsService.update(id, dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a skill by ID' })
  async remove(@Param('id') id: string) {
    await this.skillsService.remove(id);
  }
}
