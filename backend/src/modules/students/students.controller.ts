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
import { ApiPaginatedResponse, CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser, type PaginatedResult } from '@/common/types';

import { CreateStudentDto, ListStudentsDto, StudentResponseDto, UpdateStudentDto } from './dto';
import { type Actor, StudentsService } from './students.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Students')
@ApiBearerAuth('access-token')
@Controller({ path: 'students', version: '1' })
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.student.read)
  @ApiOperation({
    summary: "List this school's students",
    description:
      'Paged and scoped to the caller’s school. `search` matches admission number, name, and ' +
      'class name.',
  })
  @ApiPaginatedResponse(StudentResponseDto)
  findAll(
    @Query() query: ListStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<StudentResponseDto>> {
    return this.students.findAll(query, actorOf(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.student.read)
  @ApiOperation({ summary: 'Fetch a single student, with their guardians' })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiNotFoundResponse({ description: 'No such student' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentResponseDto> {
    return this.students.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.student.create)
  @ApiOperation({
    summary: 'Enrol a student',
    description: 'Class and section are optional — a student can be enrolled before being placed.',
  })
  @ApiCreatedResponse({ type: StudentResponseDto })
  @ApiBadRequestResponse({ description: 'Section does not belong to the chosen class' })
  @ApiConflictResponse({ description: 'Admission number already used' })
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentResponseDto> {
    return this.students.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.student.update)
  @ApiOperation({ summary: 'Edit a student, or move them to another class' })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiConflictResponse({ description: 'Admission number already used' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentResponseDto> {
    return this.students.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.student.delete)
  @ApiOperation({
    summary: 'Delete a student',
    description:
      'Guardian links go with them; the guardians themselves are users and survive untouched. ' +
      'Set the status to TRANSFERRED or GRADUATED to retain the record instead.',
  })
  @ApiNoContentResponse({ description: 'Student deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.students.remove(id, actorOf(user));
  }
}
