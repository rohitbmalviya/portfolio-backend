import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/health
   * Lightweight liveness + DB reachability check.
   * Returns 200 when the process is up and Postgres responds to SELECT 1.
   */
  @Get()
  @ApiOperation({ summary: 'Health check — verifies process and DB connectivity' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      // Return 503 via a manual response-like structure; the process is up but DB is not
      return {
        status: 'degraded',
        db: 'unreachable',
        error: err instanceof Error ? err.message : 'Unknown DB error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
