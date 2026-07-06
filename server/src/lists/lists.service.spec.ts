import { ForbiddenException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';
const LIST = 'list-1';

function makePrisma() {
  return {
    taskList: {
      create: jest.fn().mockResolvedValue({ id: LIST }),
      update: jest.fn().mockResolvedValue({ id: LIST }),
      delete: jest.fn().mockResolvedValue({ id: LIST }),
      findUniqueOrThrow: jest.fn(),
    },
  };
}

function makeAccess() {
  return {
    assertCanReadList: jest.fn().mockResolvedValue(undefined),
    assertCanWriteList: jest.fn().mockResolvedValue(undefined),
    assertListOwner: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ListsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let access: ReturnType<typeof makeAccess>;
  let lists: ListsService;

  beforeEach(() => {
    prisma = makePrisma();
    access = makeAccess();
    lists = new ListsService(
      prisma as unknown as PrismaService,
      access as unknown as AccessService,
    );
  });

  describe('create', () => {
    it('owns the list to the caller and never sets isInbox', async () => {
      await lists.create(USER, { name: 'Work' } as any);
      const data = prisma.taskList.create.mock.calls[0][0].data;
      expect(data.ownerId).toBe(USER);
      expect('isInbox' in data).toBe(false); // Inbox is only made at signup
    });
  });

  describe('update', () => {
    it('requires write access and applies only provided fields', async () => {
      await lists.update(USER, LIST, { name: 'Renamed' } as any);
      expect(access.assertCanWriteList).toHaveBeenCalledWith(USER, LIST);
      const data = prisma.taskList.update.mock.calls[0][0].data;
      expect(data).toEqual({ name: 'Renamed' });
    });

    it('disconnects the group when groupId is set to null', async () => {
      await lists.update(USER, LIST, { groupId: null } as any);
      const data = prisma.taskList.update.mock.calls[0][0].data;
      expect(data.group).toEqual({ disconnect: true });
    });
  });

  describe('remove', () => {
    it('is owner-gated', async () => {
      prisma.taskList.findUniqueOrThrow.mockResolvedValue({ isInbox: false });
      await lists.remove(USER, LIST);
      expect(access.assertListOwner).toHaveBeenCalledWith(USER, LIST);
    });

    it('refuses to delete the Inbox', async () => {
      prisma.taskList.findUniqueOrThrow.mockResolvedValue({ isInbox: true });
      await expect(lists.remove(USER, LIST)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.taskList.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-Inbox list', async () => {
      prisma.taskList.findUniqueOrThrow.mockResolvedValue({ isInbox: false });
      await lists.remove(USER, LIST);
      expect(prisma.taskList.delete).toHaveBeenCalledWith({
        where: { id: LIST },
      });
    });
  });
});
