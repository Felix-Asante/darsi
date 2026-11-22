import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export class CursorQueryDto {
  /** The `nextCursor` of the previous page. */
  @IsOptional()
  @IsUUID(7)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Ids are UUIDv7, so they sort by creation time and double as the cursor.
 * Fetches one extra row to know whether another page exists.
 */
export async function paginate<T extends ObjectLiteral & { id: string }>(
  query: SelectQueryBuilder<T>,
  { cursor, limit }: CursorQueryDto,
): Promise<CursorPage<T>> {
  const alias = query.alias;
  if (cursor) query.andWhere(`${alias}.id > :cursor`, { cursor });

  const rows = await query
    .orderBy(`${alias}.id`, 'ASC')
    .take(limit + 1)
    .getMany();
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
