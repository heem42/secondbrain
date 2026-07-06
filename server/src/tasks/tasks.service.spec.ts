import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';
const LIST = 'list-1';
const TASK = 'task-1';

function makePrisma() {
  return {
    task: {
      create: jest.fn().mockResolvedValue({ id: TASK }),
      update: jest.fn().mockResolvedValue({ id: TASK }),
      delete: jest.fn().mockResolvedValue({ id: TASK }),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
}

function makeAccess() {
  return {
    assertCanReadList: jest.fn().mockResolvedValue(undefined),
    assertCanWriteList: jest.fn().mockResolvedValue(undefined),
    canReadTask: jest.fn().mockResolvedValue(true),
    canWriteTask: jest.fn().mockResolvedValue(true),
  };
}

describe('TasksService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let access: ReturnType<typeof makeAccess>;
  let tasks: TasksService;

  beforeEach(() => {
    prisma = makePrisma();
    access = makeAccess();
    tasks = new TasksService(
      prisma as unknown as PrismaService,
      access as unknown as AccessService,
    );
  });

  describe('create', () => {
    it('requires write access to the target list', async () => {
      await tasks.create(USER, { listId: LIST, title: 'x' } as any);
      expect(access.assertCanWriteList).toHaveBeenCalledWith(USER, LIST);
    });

    it('stamps createdBy and leaves completedAt unset for a todo', async () => {
      await tasks.create(USER, { listId: LIST, title: 'x' } as any);
      const data = prisma.task.create.mock.calls[0][0].data;
      expect(data.createdBy).toBe(USER);
      expect(data.completedAt).toBeUndefined();
    });

    it('sets completedAt when created already done', async () => {
      await tasks.create(USER, {
        listId: LIST,
        title: 'x',
        status: TaskStatus.done,
      } as any);
      const data = prisma.task.create.mock.calls[0][0].data;
      expect(data.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('update — completedAt derivation', () => {
    it('sets completedAt when transitioning to done', async () => {
      await tasks.update(USER, TASK, { status: TaskStatus.done } as any);
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.status).toBe(TaskStatus.done);
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when transitioning away from done', async () => {
      await tasks.update(USER, TASK, { status: TaskStatus.todo } as any);
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.status).toBe(TaskStatus.todo);
      expect(data.completedAt).toBeNull();
    });

    it('does not touch status/completedAt when status is absent', async () => {
      await tasks.update(USER, TASK, { title: 'renamed' } as any);
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.title).toBe('renamed');
      expect('completedAt' in data).toBe(false);
      expect('status' in data).toBe(false);
    });
  });

  describe('update — authorization', () => {
    it('throws 404 when the task is not readable', async () => {
      access.canReadTask.mockResolvedValue(false);
      await expect(
        tasks.update(USER, TASK, { title: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when readable but not writable', async () => {
      access.canWriteTask.mockResolvedValue(false);
      await expect(
        tasks.update(USER, TASK, { title: 'x' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('checks write access on the destination list when moving', async () => {
      await tasks.update(USER, TASK, { listId: 'list-2' } as any);
      expect(access.assertCanWriteList).toHaveBeenCalledWith(USER, 'list-2');
      const data = prisma.task.update.mock.calls[0][0].data;
      expect(data.list).toEqual({ connect: { id: 'list-2' } });
    });
  });

  describe('remove', () => {
    it('throws 404 when not readable', async () => {
      access.canReadTask.mockResolvedValue(false);
      await expect(tasks.remove(USER, TASK)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('throws 403 when readable but not writable', async () => {
      access.canWriteTask.mockResolvedValue(false);
      await expect(tasks.remove(USER, TASK)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it('deletes when authorized', async () => {
      await tasks.remove(USER, TASK);
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: TASK } });
    });
  });
});
