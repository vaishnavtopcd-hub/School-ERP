import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SystemRoleKey } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '@/common/constants';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { type AuthenticatedUser } from '@/common/types';

import { CreateMediumDto, MediumResponseDto, UpdateMediumDto } from './dto';
import { type Actor, MediumsService } from './mediums.service';

const actorOf = (user: AuthenticatedUser): Actor => ({
  id: user.id,
  schoolId: user.schoolId,
  isSuperAdmin: user.systemKeys.includes(SystemRoleKey.SUPER_ADMIN),
});

@ApiTags('Mediums')
@ApiBearerAuth('access-token')
@Controller({ path: 'mediums', version: '1' })
export class MediumsController {
  constructor(private readonly mediums: MediumsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.medium.read)
  @ApiOperation({
    summary: "List this school's mediums",
    description: 'Scoped to the caller’s school.',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Only mediums still on offer. Use for pickers.',
  })
  @ApiOkResponse({ type: MediumResponseDto, isArray: true })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('activeOnly', new ParseBoolPipe({ optional: true })) activeOnly?: boolean,
  ): Promise<MediumResponseDto[]> {
    return this.mediums.findAll(actorOf(user), activeOnly ?? false);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.medium.read)
  @ApiOperation({ summary: 'Fetch a single medium' })
  @ApiOkResponse({ type: MediumResponseDto })
  @ApiNotFoundResponse({ description: 'No such medium' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediumResponseDto> {
    return this.mediums.findOne(id, actorOf(user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.medium.create)
  @ApiOperation({ summary: 'Add a medium' })
  @ApiCreatedResponse({ type: MediumResponseDto })
  @ApiConflictResponse({ description: 'Name already used in this school' })
  create(
    @Body() dto: CreateMediumDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediumResponseDto> {
    return this.mediums.create(dto, actorOf(user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.medium.update)
  @ApiOperation({
    summary: 'Rename or deactivate a medium',
    description: 'Renaming updates every section using it, since they reference it by id.',
  })
  @ApiOkResponse({ type: MediumResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediumDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediumResponseDto> {
    return this.mediums.update(id, dto, actorOf(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.medium.delete)
  @ApiOperation({
    summary: 'Delete a medium',
    description: 'Refused while any section uses it — deactivate to retire one instead.',
  })
  @ApiNoContentResponse({ description: 'Medium deleted' })
  @ApiConflictResponse({ description: 'Still in use by sections' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.mediums.remove(id, actorOf(user));
  }
}
