import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';

/** Readiness probe — confirms the database actually answers a query. */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const startedAt = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true, { responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown database error',
        }),
      );
    }
  }
}
