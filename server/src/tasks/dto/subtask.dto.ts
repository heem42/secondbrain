import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSubtaskDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateSubtaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
