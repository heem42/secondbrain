import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The authorization boundary (ARCHITECTURE.md §6). This is the API-layer port of
 * the Supabase RLS policies + SECURITY DEFINER helpers
 * (supabase/migrations/20260703134813_rls_policies.sql): access to a list = owner
 * OR a row in list_members; tasks/subtasks/task_tags inherit their list's access;
 * writes additionally require an owner/editor role.
 *
 * Every method takes the acting `userId` explicitly — nothing here trusts a client
 * payload. The `assert*` methods throw 404 when the row is invisible to the caller
 * (so we don't leak existence) and 403 when it's visible but read-only.
 */
@Injectable()
export class AccessService {
  private static readonly WRITE_ROLES: MemberRole[] = [
    MemberRole.owner,
    MemberRole.editor,
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ---- lists (mirror is_list_owner / can_read_list / can_write_list) --------

  async isListOwner(userId: string, listId: string): Promise<boolean> {
    const list = await this.prisma.taskList.findUnique({
      where: { id: listId },
      select: { ownerId: true },
    });
    return list?.ownerId === userId;
  }

  async canReadList(userId: string, listId: string): Promise<boolean> {
    const list = await this.prisma.taskList.findUnique({
      where: { id: listId },
      select: {
        ownerId: true,
        members: { where: { userId }, select: { userId: true } },
      },
    });
    if (!list) return false;
    return list.ownerId === userId || list.members.length > 0;
  }

  async canWriteList(userId: string, listId: string): Promise<boolean> {
    const list = await this.prisma.taskList.findUnique({
      where: { id: listId },
      select: {
        ownerId: true,
        members: {
          where: { userId, role: { in: AccessService.WRITE_ROLES } },
          select: { userId: true },
        },
      },
    });
    if (!list) return false;
    return list.ownerId === userId || list.members.length > 0;
  }

  // ---- tasks (mirror can_read_task / can_write_task) ------------------------

  async canReadTask(userId: string, taskId: string): Promise<boolean> {
    const listId = await this.listIdForTask(taskId);
    return listId ? this.canReadList(userId, listId) : false;
  }

  async canWriteTask(userId: string, taskId: string): Promise<boolean> {
    const listId = await this.listIdForTask(taskId);
    return listId ? this.canWriteList(userId, listId) : false;
  }

  // ---- assert helpers (used by services/guards) -----------------------------

  async assertCanReadList(userId: string, listId: string): Promise<void> {
    if (!(await this.canReadList(userId, listId))) {
      throw new NotFoundException('List not found');
    }
  }

  async assertCanWriteList(userId: string, listId: string): Promise<void> {
    if (!(await this.canReadList(userId, listId))) {
      throw new NotFoundException('List not found');
    }
    if (!(await this.canWriteList(userId, listId))) {
      throw new ForbiddenException('You do not have write access to this list');
    }
  }

  async assertListOwner(userId: string, listId: string): Promise<void> {
    if (!(await this.canReadList(userId, listId))) {
      throw new NotFoundException('List not found');
    }
    if (!(await this.isListOwner(userId, listId))) {
      throw new ForbiddenException('Only the list owner can do this');
    }
  }

  private async listIdForTask(taskId: string): Promise<string | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { listId: true },
    });
    return task?.listId ?? null;
  }
}
