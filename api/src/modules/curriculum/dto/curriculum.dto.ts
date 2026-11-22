import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

const CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}$/;

export class FrameworkDto {
  @Matches(CODE)
  code: string;

  @IsString()
  @Length(1, 160)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;
}

export class StandardDto {
  @Matches(CODE)
  code: string;

  @IsString()
  @Length(1, 2000)
  description: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
