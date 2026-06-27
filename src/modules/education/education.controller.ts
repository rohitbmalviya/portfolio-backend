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
import { EducationService } from './education.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { ReorderEducationDto } from './dto/reorder-education.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('education')
@Controller('education')
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get()
  @ApiOperation({ summary: 'List all education entries ordered' })
  async findAll() {
    return { data: await this.educationService.findAll() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an education entry by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.educationService.findOne(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create an education entry' })
  async create(@Body() dto: CreateEducationDto) {
    return { data: await this.educationService.create(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder education entries' })
  async reorder(@Body() dto: ReorderEducationDto) {
    return { data: await this.educationService.reorder(dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update an education entry by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateEducationDto) {
    return { data: await this.educationService.update(id, dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete an education entry by ID' })
  async remove(@Param('id') id: string) {
    await this.educationService.remove(id);
  }
}
