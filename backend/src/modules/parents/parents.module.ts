import { Module } from '@nestjs/common';

import { UsersModule } from '@/modules/users/users.module';

import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

/** Imports UsersModule so account creation is not reimplemented here. */
@Module({
  imports: [UsersModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
