import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Reusable `:id` path param validator for UUID primary keys. */
export class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;
}
