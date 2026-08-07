import { Module } from '@nestjs/common';

import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';

/**
 * One module for both halves: the day's period ladder and the lessons placed
 * into it. They are separate resources with separate permissions, but neither
 * means anything without the other.
 */
@Module({
  controllers: [PeriodsController, TimetableController],
  providers: [PeriodsService, TimetableService],
  exports: [PeriodsService, TimetableService],
})
export class TimetableModule {}
