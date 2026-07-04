import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateSubtaskDto, UpdateSubtaskDto } from './dto/subtask.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Tasks in a list the caller can read (tasks_select: can_read_list). */
  async findByList(userId: string, listId: string) {
    await this.access.assertCanReadList(userId, listId);
    return this.prisma.task.findMany({
      where: { listId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    if (!(await this.access.canReadTask(userId, id))) {
      throw new NotFoundException('Task not found');
    }
    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: { subtasks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  /** Create requires write access to the target list (tasks_insert: can_write_list). */
  async create(userId: string, dto: CreateTaskDto) {
    await this.access.assertCanWriteList(userId, dto.listId);
    const status = dto.status ?? TaskStatus.todo;
    return this.prisma.task.create({
      data: {
        id: dto.id,
        listId: dto.listId,
        createdBy: userId,
        title: dto.title,
        notes: dto.notes,
        status,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : undefined,
        recurrenceRule: dto.recurrenceRule,
        geoLat: dto.geoLat,
        geoLng: dto.geoLng,
        geoRadius: dto.geoRadius,
        geoTrigger: dto.geoTrigger,
        sortOrder: dto.sortOrder ?? 0,
        completedAt: status === TaskStatus.done ? new Date() : undefined,
      },
    });
  }

  /** Update requires write access to the task (tasks_update: can_write_list). */
  async update(userId: string, id: string, dto: UpdateTaskDto) {
    if (!(await this.access.canReadTask(userId, id))) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanWriteTaskOrThrow(userId, id);

    // Moving to another list requires write access on the destination too.
    if (dto.listId !== undefined) {
      await this.access.assertCanWriteList(userId, dto.listId);
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.listId !== undefined) data.list = { connect: { id: dto.listId } };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.recurrenceRule !== undefined)
      data.recurrenceRule = dto.recurrenceRule;
    if (dto.geoLat !== undefined) data.geoLat = dto.geoLat;
    if (dto.geoLng !== undefined) data.geoLng = dto.geoLng;
    if (dto.geoRadius !== undefined) data.geoRadius = dto.geoRadius;
    if (dto.geoTrigger !== undefined) data.geoTrigger = dto.geoTrigger;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.dueAt !== undefined)
      data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.remindAt !== undefined)
      data.remindAt = dto.remindAt ? new Date(dto.remindAt) : null;

    // Derive completed_at from status transitions.
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.completedAt = dto.status === TaskStatus.done ? new Date() : null;
    }

    return this.prisma.task.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    if (!(await this.access.canReadTask(userId, id))) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanWriteTaskOrThrow(userId, id);
    await this.prisma.task.delete({ where: { id } });
  }

  // ---- subtasks (subtasks_* policies: inherit parent task's list access) ----

  async listSubtasks(userId: string, taskId: string) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createSubtask(userId: string, taskId: string, dto: CreateSubtaskDto) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanWriteTaskOrThrow(userId, taskId);
    return this.prisma.subtask.create({
      data: {
        id: dto.id,
        taskId,
        title: dto.title,
        isDone: dto.isDone ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSubtask(
    userId: string,
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanWriteTaskOrThrow(userId, taskId);
    await this.assertSubtaskBelongsToTask(subtaskId, taskId);
    return this.prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        title: dto.title,
        isDone: dto.isDone,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async removeSubtask(userId: string, taskId: string, subtaskId: string) {
    if (!(await this.access.canReadTask(userId, taskId))) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanWriteTaskOrThrow(userId, taskId);
    await this.assertSubtaskBelongsToTask(subtaskId, taskId);
    await this.prisma.subtask.delete({ where: { id: subtaskId } });
  }

  // ---- helpers --------------------------------------------------------------

  private async assertCanWriteTaskOrThrow(userId: string, taskId: string) {
    if (!(await this.access.canWriteTask(userId, taskId))) {
      throw new ForbiddenException('You do not have write access to this task');
    }
  }

  private async assertSubtaskBelongsToTask(subtaskId: string, taskId: string) {
    const subtask = await this.prisma.subtask.findUnique({
      where: { id: subtaskId },
      select: { taskId: true },
    });
    if (!subtask || subtask.taskId !== taskId) {
      throw new NotFoundException('Subtask not found');
    }
  }
}
