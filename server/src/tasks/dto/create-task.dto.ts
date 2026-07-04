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

export class CreateTaskDto {
  // Client-generatable UUID (§11).
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  listId!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsISO8601()
  remindAt?: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsNumber()
  geoLat?: number;

  @IsOptional()
  @IsNumber()
  geoLng?: number;

  @IsOptional()
  @IsNumber()
  geoRadius?: number;

  @IsOptional()
  @IsEnum(GeoTrigger)
  geoTrigger?: GeoTrigger;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
