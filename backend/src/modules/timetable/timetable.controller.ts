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
  Query,
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

import {
  CreateTimetableEntryDto,
  TimetableEntryResponseDto,
  UpdateTimetableEntryDto,
  WeeklyTimetableDto,
  WeeklyTimetableQueryDto,
} from './dto';
import { type Actor } from './periods.service';
import { TimetableService } from './timetable.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Timetable')
@ApiBearerAuth('access-token')
@Controller({ path: 'timetable', version: '1' })
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get('weekly')
  @RequirePermissions(PERMISSIONS.timetable.read)
  @ApiOperation({
    summary: 'A whole week, for one section or one teacher',
    description:
      'Supply exactly one of `sectionId` or `teacherId`. The period ladder comes back with the ' +
      'entries because the grid cannot be drawn without it.',
  })
  @ApiOkResponse({ type: WeeklyTimetableDto })
  @ApiBadRequestResponse({ description: 'Both or neither of sectionId and teacherId supplied' })
  weekly(
    @Query() query: WeeklyTimetableQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WeeklyTimetableDto> {
    return this.timetable.weekly(query, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.timetable.create)
  @ApiOperation({
    summary: 'Schedule a lesson',
    description:
      'Refused if the section is already taught in that period, or if the teacher is already ' +
      'somewhere else in it. The subject must belong to the section’s class.',
  })
  @ApiCreatedResponse({ type: TimetableEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Break period, or subject from another class' })
  @ApiConflictResponse({ description: 'Teacher clash or classroom clash' })
  create(
    @Body() dto: CreateTimetableEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimetableEntryResponseDto> {
    return this.timetable.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.timetable.update)
  @ApiOperation({
    summary: 'Change a lesson, or move it to another slot',
    description: 'Clash rules are applied to where the lesson is going, not where it was.',
  })
  @ApiOkResponse({ type: TimetableEntryResponseDto })
  @ApiConflictResponse({ description: 'Teacher clash or classroom clash' })
  @ApiNotFoundResponse({ description: 'No such entry' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TimetableEntryResponseDto> {
    return this.timetable.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.timetable.delete)
  @ApiOperation({ summary: 'Clear a slot' })
  @ApiNoContentResponse({ description: 'Lesson removed' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.timetable.remove(id, actorOf(user));
  }
}
