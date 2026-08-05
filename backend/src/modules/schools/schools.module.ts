import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';

import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

/** AuthModule supplies PasswordService for hashing the first admin's password. */
@Module({
  imports: [AuthModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
