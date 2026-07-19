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
import { ExperienceService } from './experience.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { ReorderExperienceDto } from './dto/reorder-experience.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('experience')
@Controller('experience')
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @Get()
  @ApiOperation({ summary: 'List all experience entries ordered' })
  async findAll() {
    return { data: await this.experienceService.findAll() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an experience entry by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.experienceService.findOne(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create an experience entry' })
  async create(@Body() dto: CreateExperienceDto, @CurrentUser() user: AdminUser) {
    return { data: await this.experienceService.create(dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder experience entries' })
  async reorder(@Body() dto: ReorderExperienceDto, @CurrentUser() user: AdminUser) {
    return { data: await this.experienceService.reorder(dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update an experience entry by ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.experienceService.update(id, dto, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete an experience entry by ID' })
  async remove(@Param('id') id: string) {
    await this.experienceService.remove(id);
  }
}
