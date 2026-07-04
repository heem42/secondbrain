import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ---- tags: fully private to owner (tags_all policy) -----------------------

  findAllForUser(userId: string) {
    return this.prisma.tag.findMany({
      where: { ownerId: userId },
      orderBy: { name: 'asc' },
    });
  }

  create(userId: string, dto: CreateTagDto) {
    return this.prisma.tag.create({
      data: {
        id: dto.id,
        ownerId: userId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTagDto) {
    await this.assertOwnedTag(userId, id);
    return this.prisma.tag.update({
      where: { id },
      data: { name: dto.name, color: dto.color },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnedTag(userId, id);
    await this.prisma.tag.delete({ where: { id } });
  }

  // ---- task_tags (task_tags_* policies) -------------------------------------
  // Link visible if you can read the task; writable if you can write the task
  // AND the tag is your own.

  async linkTag(userId: string, taskId: string, tagId: string) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    if (!(await this.access.canWriteTask(userId, taskId))) {
      throw new ForbiddenException('You do not have write access to this task');
    }
    await this.assertOwnedTag(userId, tagId);
    return this.prisma.taskTag.upsert({
      where: { taskId_tagId: { taskId, tagId } },
      create: { taskId, tagId },
      update: {},
    });
  }

  async unlinkTag(userId: string, taskId: string, tagId: string) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    if (!(await this.access.canWriteTask(userId, taskId))) {
      throw new ForbiddenException('You do not have write access to this task');
    }
    await this.assertOwnedTag(userId, tagId);
    await this.prisma.taskTag
      .delete({ where: { taskId_tagId: { taskId, tagId } } })
      .catch(() => undefined);
  }

  private async assertOwnedTag(userId: string, tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      select: { ownerId: true },
    });
    if (!tag || tag.ownerId !== userId) {
      throw new NotFoundException('Tag not found');
    }
  }
}
