import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser } from '@/common/types';

import { type Actor, AttendanceService } from './attendance.service';
import {
  AttendanceOverviewDto,
  ClearedDayDto,
  DailyRegisterDto,
  DailyRegisterQueryDto,
  MarkAttendanceDto,
  MonthlyReportDto,
  MonthlyReportQueryDto,
  OverviewQueryDto,
  StudentAttendanceDto,
  StudentHistoryQueryDto,
} from './dto';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@Controller({ path: 'attendance', version: '1' })
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // Declared before the parameterised routes below — Nest matches in
  // declaration order, and `:studentId` would otherwise swallow these.
  @Get('overview')
  @RequirePermissions(PERMISSIONS.attendance.read)
  @ApiOperation({
    summary: 'Every section, and how far its register has got today',
    description:
      'The landing screen. A school takes attendance section by section, so the first question ' +
      'is which sections are outstanding rather than which student.',
  })
  @ApiOkResponse({ type: AttendanceOverviewDto })
  overview(
    @Query() query: OverviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceOverviewDto> {
    return this.attendance.overview(query.date, actorOf(user));
  }

  @Get('daily')
  @RequirePermissions(PERMISSIONS.attendance.read)
  @ApiOperation({
    summary: 'The register for one section on one day',
    description:
      'Every enrolled student in the section, each carrying their mark for that date if one has ' +
      'been made. Built from the roster, so an untouched day still returns the full list to fill in.',
  })
  @ApiOkResponse({ type: DailyRegisterDto })
  @ApiNotFoundResponse({ description: 'No such section' })
  daily(
    @Query() query: DailyRegisterQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyRegisterDto> {
    return this.attendance.dailyRegister(query, actorOf(user));
  }

  @Post('daily')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.attendance.create)
  @ApiOperation({
    summary: 'Take the register',
    description:
      'One transaction for the whole class — a half-marked register is worse than an unmarked ' +
      'one. Marking a student who already has a mark for that date corrects it. Returns the ' +
      'register as it now stands.',
  })
  @ApiOkResponse({ type: DailyRegisterDto })
  @ApiBadRequestResponse({
    description: 'Future date, duplicate student, or a student outside this section',
  })
  mark(
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DailyRegisterDto> {
    return this.attendance.mark(dto, actorOf(user));
  }

  @Delete('daily')
  @RequirePermissions(PERMISSIONS.attendance.delete)
  @ApiOperation({
    summary: "Erase a day's register for one section",
    description:
      'For a day marked by mistake — the wrong date, the wrong section. Correcting a mark is ' +
      're-marking; this is for a register that should not exist at all, which re-marking cannot ' +
      'express because "no answer" is not one of the four statuses.',
  })
  @ApiOkResponse({ description: 'How many marks were removed', type: ClearedDayDto })
  clearDay(
    @Query() query: DailyRegisterQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClearedDayDto> {
    return this.attendance.clearDay(query, actorOf(user));
  }

  @Get('monthly')
  @RequirePermissions(PERMISSIONS.attendance.read)
  @ApiOperation({
    summary: "A section's month",
    description:
      'A row per student with their marks and their tally. `dates` holds only the days that were ' +
      'actually taken, so a school marking three days a week does not get a wall of gaps.',
  })
  @ApiOkResponse({ type: MonthlyReportDto })
  monthly(
    @Query() query: MonthlyReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyReportDto> {
    return this.attendance.monthlyReport(query, actorOf(user));
  }

  /**
   * The guardian's view.
   *
   * Takes no student id by design: what comes back is derived from who is
   * asking, so holding this permission cannot be turned into reading somebody
   * else's child by changing a parameter.
   */
  @Get('my-children')
  @RequirePermissions(PERMISSIONS.attendance.readOwn)
  @ApiOperation({
    summary: "A guardian's own children",
    description:
      'Scoped to the students the caller is recorded as a guardian of. Returns an empty list for ' +
      'a caller who is not a guardian of anyone.',
  })
  @ApiOkResponse({ type: StudentAttendanceDto, isArray: true })
  myChildren(
    @Query() query: StudentHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentAttendanceDto[]> {
    return this.attendance.myChildren(query.month, actorOf(user));
  }

  @Get('student/:studentId')
  @RequirePermissions(PERMISSIONS.attendance.read)
  @ApiOperation({
    summary: "One student's month",
    description: 'Defaults to the current month. Scoped to the caller’s school.',
  })
  @ApiOkResponse({ type: StudentAttendanceDto })
  @ApiNotFoundResponse({ description: 'No such student' })
  student(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: StudentHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentAttendanceDto> {
    return this.attendance.studentMonth(studentId, query.month, actorOf(user));
  }
}
