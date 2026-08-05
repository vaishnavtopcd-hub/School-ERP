import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicYearStatus } from '@prisma/client';

export class AcademicYearResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '2025-2026' }) name!: string;

  @ApiProperty({ example: '2025-06-01', description: 'Date only, no timezone' })
  startDate!: string;

  @ApiProperty({ example: '2026-03-31', description: 'Date only, no timezone' })
  endDate!: string;

  @ApiProperty({ enum: AcademicYearStatus }) status!: AcademicYearStatus;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;

  @ApiProperty({
    description: 'True when today falls inside the session, regardless of status',
  })
  isCurrent!: boolean;
}

export class ActivateAcademicYearResponseDto {
  @ApiProperty({ type: AcademicYearResponseDto })
  activated!: AcademicYearResponseDto;

  @ApiPropertyOptional({
    type: AcademicYearResponseDto,
    nullable: true,
    description: 'The year that was archived to make room, if there was one.',
  })
  archived!: AcademicYearResponseDto | null;
}
