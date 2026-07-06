import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';
import { PrismaService } from '../prisma/prisma.service';

// The authorization boundary (ARCHITECTURE.md §6). Prisma is mocked so these
// tests pin the access *rules*, not the database.

const OWNER = 'user-owner';
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';
const LIST = 'list-1';
const TASK = 'task-1';

function makePrisma() {
  return {
    taskList: { findUnique: jest.fn() },
    task: { findUnique: jest.fn() },
  };
}

describe('AccessService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let access: AccessService;

  beforeEach(() => {
    prisma = makePrisma();
    access = new AccessService(prisma as unknown as PrismaService);
  });

  describe('canReadList', () => {
    it('is true for the owner', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      expect(await access.canReadList(OWNER, LIST)).toBe(true);
    });

    it('is true for a member', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [{ userId: MEMBER }],
      });
      expect(await access.canReadList(MEMBER, LIST)).toBe(true);
    });

    it('is false for a stranger', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      expect(await access.canReadList(STRANGER, LIST)).toBe(false);
    });

    it('is false when the list does not exist', async () => {
      prisma.taskList.findUnique.mockResolvedValue(null);
      expect(await access.canReadList(OWNER, LIST)).toBe(false);
    });
  });

  describe('canWriteList', () => {
    it('is true for the owner', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      expect(await access.canWriteList(OWNER, LIST)).toBe(true);
    });

    it('is true for an editor/owner member (query filters to write roles)', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [{ userId: MEMBER }],
      });
      expect(await access.canWriteList(MEMBER, LIST)).toBe(true);
    });

    it('is false for a viewer (write-role filter yields no member row)', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      expect(await access.canWriteList(MEMBER, LIST)).toBe(false);
    });
  });

  describe('task access inherits from the parent list', () => {
    it('canReadTask resolves the task list then checks list read access', async () => {
      prisma.task.findUnique.mockResolvedValue({ listId: LIST });
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      expect(await access.canReadTask(OWNER, TASK)).toBe(true);
      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: TASK },
        select: { listId: true },
      });
    });

    it('canReadTask is false when the task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      expect(await access.canReadTask(OWNER, TASK)).toBe(false);
      expect(prisma.taskList.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('assert helpers', () => {
    it('assertCanReadList throws 404 when not readable', async () => {
      prisma.taskList.findUnique.mockResolvedValue(null);
      await expect(access.assertCanReadList(STRANGER, LIST)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('assertCanWriteList throws 404 when the list is invisible', async () => {
      // canReadList → null → not readable
      prisma.taskList.findUnique.mockResolvedValue(null);
      await expect(
        access.assertCanWriteList(STRANGER, LIST),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assertCanWriteList throws 403 when readable but read-only (viewer)', async () => {
      // 1st call = canReadList (member present), 2nd = canWriteList (filtered out)
      prisma.taskList.findUnique
        .mockResolvedValueOnce({ ownerId: OWNER, members: [{ userId: MEMBER }] })
        .mockResolvedValueOnce({ ownerId: OWNER, members: [] });
      await expect(
        access.assertCanWriteList(MEMBER, LIST),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('assertCanWriteList resolves for a writer', async () => {
      prisma.taskList.findUnique.mockResolvedValue({
        ownerId: OWNER,
        members: [],
      });
      await expect(
        access.assertCanWriteList(OWNER, LIST),
      ).resolves.toBeUndefined();
    });

    it('assertListOwner throws 403 for a non-owner member', async () => {
      // canReadList sees the member; isListOwner sees a different owner
      prisma.taskList.findUnique
        .mockResolvedValueOnce({ ownerId: OWNER, members: [{ userId: MEMBER }] })
        .mockResolvedValueOnce({ ownerId: OWNER });
      await expect(access.assertListOwner(MEMBER, LIST)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
