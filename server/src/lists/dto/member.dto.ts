import { IsEnum, IsUUID } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class AddMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}

export class UpdateMemberDto {
  @IsEnum(MemberRole)
  role!: MemberRole;
}
