import {
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateListDto {
  // Client-generatable UUID (ARCHITECTURE.md §11: offline creation, idempotent POST).
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
