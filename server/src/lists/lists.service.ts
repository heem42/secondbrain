import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Every list the user owns or is a member of (lists_select policy). */
  findAllForUser(userId: string) {
    return this.prisma.taskList.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    await this.access.assertCanReadList(userId, id);
    return this.prisma.taskList.findUniqueOrThrow({ where: { id } });
  }

  /** Create a list owned by the caller (lists_insert: owner_id = auth.uid()). */
  create(userId: string, dto: CreateListDto) {
    return this.prisma.taskList.create({
      data: {
        id: dto.id,
        ownerId: userId,
        name: dto.name,
        groupId: dto.groupId,
        color: dto.color,
        sortOrder: dto.sortOrder ?? 0,
        // isInbox is never client-settable — the single Inbox is created at signup.
      },
    });
  }

  /** Update requires owner/editor access (lists_update: can_write_list). */
  async update(userId: string, id: string, dto: UpdateListDto) {
    await this.access.assertCanWriteList(userId, id);
    const data: Prisma.TaskListUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.groupId !== undefined) {
      data.group =
        dto.groupId === null
          ? { disconnect: true }
          : { connect: { id: dto.groupId } };
    }
    return this.prisma.taskList.update({ where: { id }, data });
  }

  /** Delete is owner-only (lists_delete: owner_id = auth.uid()). */
  async remove(userId: string, id: string) {
    await this.access.assertListOwner(userId, id);
    const list = await this.prisma.taskList.findUniqueOrThrow({
      where: { id },
      select: { isInbox: true },
    });
    if (list.isInbox) {
      throw new ForbiddenException('The Inbox list cannot be deleted');
    }
    await this.prisma.taskList.delete({ where: { id } });
  }

  // ---- members (list_members_* policies) ------------------------------------

  /** Roster is visible to anyone who can read the list. */
  async listMembers(userId: string, listId: string) {
    await this.access.assertCanReadList(userId, listId);
    return this.prisma.listMember.findMany({
      where: { listId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  /** Only the owner manages membership (list_members_insert: is_list_owner). */
  async addMember(userId: string, listId: string, dto: AddMemberDto) {
    await this.access.assertListOwner(userId, listId);
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.listMember.upsert({
      where: { listId_userId: { listId, userId: dto.userId } },
      create: { listId, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
    });
  }

  async updateMember(
    userId: string,
    listId: string,
    memberUserId: string,
    dto: UpdateMemberDto,
  ) {
    await this.access.assertListOwner(userId, listId);
    return this.prisma.listMember.update({
      where: { listId_userId: { listId, userId: memberUserId } },
      data: { role: dto.role },
    });
  }

  async removeMember(userId: string, listId: string, memberUserId: string) {
    await this.access.assertListOwner(userId, listId);
    await this.prisma.listMember.delete({
      where: { listId_userId: { listId, userId: memberUserId } },
    });
  }
}
