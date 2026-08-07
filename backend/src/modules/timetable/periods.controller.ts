import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser } from '@/common/types';

import { CreatePeriodDto, PeriodResponseDto, UpdatePeriodDto } from './dto';
import { type Actor, PeriodsService } from './periods.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Timetable')
@ApiBearerAuth('access-token')
@Controller({ path: 'periods', version: '1' })
export class PeriodsController {
  constructor(private readonly periods: PeriodsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.period.read)
  @ApiOperation({
    summary: 'The school day, in order',
    description:
      'Every class shares one ladder of periods, so this is not scoped to a class. Breaks are ' +
      'included — the grid draws them, it just cannot schedule into them.',
  })
  @ApiOkResponse({ type: PeriodResponseDto, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<PeriodResponseDto[]> {
    return this.periods.findAll(actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.period.create)
  @ApiOperation({ summary: 'Add a period to the day' })
  @ApiCreatedResponse({ type: PeriodResponseDto })
  @ApiBadRequestResponse({ description: 'A period must end after it starts' })
  @ApiConflictResponse({ description: 'That name or position in the day is taken' })
  create(
    @Body() dto: CreatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PeriodResponseDto> {
    return this.periods.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.period.update)
  @ApiOperation({
    summary: 'Edit a period',
    description:
      'Moving a period in time moves every lesson in it — the lessons reference the period, not ' +
      'the clock.',
  })
  @ApiOkResponse({ type: PeriodResponseDto })
  @ApiNotFoundResponse({ description: 'No such period' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PeriodResponseDto> {
    return this.periods.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.period.delete)
  @ApiOperation({
    summary: 'Remove a period from the day',
    description: 'Refused while lessons are scheduled in it, which deleting would take with it.',
  })
  @ApiNoContentResponse({ description: 'Period removed' })
  @ApiConflictResponse({ description: 'Lessons are still scheduled in it' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.periods.remove(id, actorOf(user));
  }
}
