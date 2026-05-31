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
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { ReorderAchievementsDto } from './dto/reorder-achievements.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'List all achievements ordered' })
  async findAll() {
    return { data: await this.achievementsService.findAll() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an achievement by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.achievementsService.findOne(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create an achievement' })
  async create(@Body() dto: CreateAchievementDto) {
    return { data: await this.achievementsService.create(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder achievements' })
  async reorder(@Body() dto: ReorderAchievementsDto) {
    return { data: await this.achievementsService.reorder(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update an achievement by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateAchievementDto) {
    return { data: await this.achievementsService.update(id, dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete an achievement by ID' })
  async remove(@Param('id') id: string) {
    await this.achievementsService.remove(id);
  }
}
