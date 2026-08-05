import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * User administration.
 *
 * Imports AuthModule to reuse PasswordService (same hashing parameters) and
 * TokenService (same revocation logic) rather than reimplementing either.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
