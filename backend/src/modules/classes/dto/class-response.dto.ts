import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassTeacherDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Asha' }) firstName!: string;
  @ApiProperty({ example: 'Rao' }) lastName!: string;
  @ApiProperty({ example: 'asha.rao@school-erp.local' }) email!: string;
}

export class SectionMediumDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Malayalam' }) name!: string;
}

export class SectionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'A' }) name!: string;
  @ApiProperty({ example: 40 }) capacity!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'uuid' }) classId!: string;

  @ApiProperty({ example: 'Science', description: "'' when the school does not stream." })
  division!: string;

  @ApiPropertyOptional({ type: SectionMediumDto, nullable: true })
  medium!: SectionMediumDto | null;

  @ApiPropertyOptional({ type: ClassTeacherDto, nullable: true })
  classTeacher!: ClassTeacherDto | null;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class ClassResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Class 10' }) name!: string;
  @ApiProperty({ example: 10 }) level!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'uuid' }) academicYearId!: string;
  @ApiProperty({ format: 'uuid' }) schoolId!: string;

  @ApiProperty({ type: SectionResponseDto, isArray: true })
  sections!: SectionResponseDto[];

  @ApiProperty({ example: 3, description: 'Number of sections' })
  sectionCount!: number;

  @ApiProperty({ example: 120, description: 'Sum of capacity across active sections' })
  totalCapacity!: number;

  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

/** Teachers eligible to be assigned as a class teacher. */
export class EligibleTeacherDto extends ClassTeacherDto {
  @ApiProperty({
    example: false,
    description: 'True when already class teacher of another section this year',
  })
  isAssigned!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'Class 9 - B' })
  assignedTo!: string | null;
}
