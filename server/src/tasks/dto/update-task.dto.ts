import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GeoTrigger, TaskPriority, TaskStatus } from '@prisma/client';

/**
 * All fields optional — prefer field-level updates over whole-row overwrites (§11).
 * Nullable fields accept `null` to clear them. Moving a task to another list is a
 * `listId` change; the service re-checks write access on the destination list.
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsUUID()
  listId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;

  @IsOptional()
  @IsISO8601()
  remindAt?: string | null;

  @IsOptional()
  @IsString()
  recurrenceRule?: string | null;

  @IsOptional()
  @IsNumber()
  geoLat?: number | null;

  @IsOptional()
  @IsNumber()
  geoLng?: number | null;

  @IsOptional()
  @IsNumber()
  geoRadius?: number | null;

  @IsOptional()
  @IsEnum(GeoTrigger)
  geoTrigger?: GeoTrigger | null;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
