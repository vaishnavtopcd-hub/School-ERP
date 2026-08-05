import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@school-erp.local' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!', minLength: 8 })
  @IsString()
  // Length is bounded but not shape-checked: rejecting a *login* on complexity
  // grounds only leaks which passwords could exist. Strength is enforced where
  // passwords are set, not where they are presented.
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
