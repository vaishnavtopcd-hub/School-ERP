import { Module } from '@nestjs/common';

import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';

@Module({
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService],
  // Exported so later modules (attendance, fees, results) can resolve the
  // active year without duplicating the lookup.
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}
