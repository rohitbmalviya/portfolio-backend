import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/health
   * Lightweight liveness + DB reachability check.
   * Returns 200 when the process is up and Postgres responds to SELECT 1.
   * Returns 503 when the DB is unreachable so platform health checks
   * (e.g. Render's healthCheckPath) actually detect DB outages.
   *
   * Uses @Res() (non-passthrough) and writes the response directly — Nest's
   * default response pipeline always re-applies the status code reflected
   * from route metadata (200 for GET) after the handler returns, which would
   * silently clobber a conditional res.status() call made under passthrough.
   */
  @Get()
  @ApiOperation({ summary: 'Health check — verifies process and DB connectivity' })
  async check(@Res() res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({
        status: 'ok',
        db: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'degraded',
        db: 'unreachable',
        error: err instanceof Error ? err.message : 'Unknown DB error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
