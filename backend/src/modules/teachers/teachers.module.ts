import { Module } from '@nestjs/common';

import { ClassesModule } from '@/modules/classes/classes.module';
import { SubjectsModule } from '@/modules/subjects/subjects.module';
import { UsersModule } from '@/modules/users/users.module';

import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

/**
 * Teaching staff.
 *
 * Imports three modules rather than reimplementing what they own: UsersModule
 * for account creation, SubjectsModule for subject allocation, and ClassesModule
 * for class-teacher allocation — the last of which holds the rules about who may
 * hold a section and how many.
 */
@Module({
  imports: [UsersModule, SubjectsModule, ClassesModule],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
