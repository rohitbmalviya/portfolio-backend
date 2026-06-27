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
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { ReorderSkillsDto } from './dto/reorder-skills.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all skills ordered by group then order' })
  async findAll() {
    return { data: await this.skillsService.findAll() };
  }

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
  async create(@Body() dto: CreateSkillDto) {
    return { data: await this.skillsService.create(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder skills' })
  async reorder(@Body() dto: ReorderSkillsDto) {
    return { data: await this.skillsService.reorder(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a skill by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return { data: await this.skillsService.update(id, dto) };
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
