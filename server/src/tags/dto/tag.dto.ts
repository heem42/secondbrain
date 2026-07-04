import {
  IsHexColor,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTagDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string | null;
}

export class LinkTagDto {
  @IsUUID()
  taskId!: string;

  @IsUUID()
  tagId!: string;
}
