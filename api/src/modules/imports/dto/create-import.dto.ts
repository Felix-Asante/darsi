import { IsIn, IsString, Length, MaxLength } from 'class-validator';
import {
  IMPORT_KINDS,
  type ImportKind,
} from '../entities/import-job.entity.js';

export class CreateImportDto {
  @IsIn(IMPORT_KINDS)
  kind: ImportKind;

  @IsString()
  @Length(1, 200)
  fileName: string;

  /** The CSV file's text, UTF-8, with a header row. */
  @IsString()
  @MaxLength(4_000_000)
  content: string;
}
