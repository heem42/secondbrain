import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// bcrypt is mocked so tests are fast and deterministic — we assert the flow,
// not the hashing itself.
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makePrisma() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn() },
    taskList: { create: jest.fn() },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock; getOrThrow: jest.Mock };
  let auth: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt.token') };
    config = {
      get: jest.fn((_k: string, d?: string) => d),
      getOrThrow: jest.fn(() => 'access-secret'),
    };
    auth = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
    mockedBcrypt.hash.mockResolvedValue('hashed' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    // Run the $transaction callback against a tx that proxies to the mocks.
    prisma.$transaction.mockImplementation((cb: any) =>
      cb({ user: prisma.user, taskList: prisma.taskList }),
    );
  });

  describe('signup', () => {
    it('creates the user and bootstraps an Inbox list, returning tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'a',
      });

      const result = await auth.signup({
        email: 'A@B.com',
        password: 'password123',
      });

      // email is normalized to lowercase
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'a@b.com', displayName: 'a' }),
        }),
      );
      // Inbox bootstrap (replaces the Supabase handle_new_user trigger)
      expect(prisma.taskList.create).toHaveBeenCalledWith({
        data: { ownerId: 'u1', name: 'Inbox', isInbox: true, sortOrder: 0 },
      });
      expect(result.accessToken).toBe('access.jwt.token');
      expect(result.refreshToken).toMatch(/^rt-1\./); // `<rowId>.<secret>`
      expect(result.user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'a',
      });
    });

    it('defaults the display name to the email local-part', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'alice@example.com',
        displayName: 'alice',
      });
      await auth.signup({ email: 'alice@example.com', password: 'password123' });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayName: 'alice' }),
        }),
      );
    });

    it('rejects a duplicate email with 409', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        auth.signup({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'a',
        passwordHash: 'hashed',
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);
      const result = await auth.login({ email: 'a@b.com', password: 'pw' });
      expect(result.user.id).toBe('u1');
      expect(result.accessToken).toBe('access.jwt.token');
    });

    it('rejects when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // still runs a compare against a dummy hash to avoid timing leaks
      mockedBcrypt.compare.mockResolvedValue(false as never);
      await expect(
        auth.login({ email: 'nope@b.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects on a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'a',
        passwordHash: 'hashed',
      });
      mockedBcrypt.compare.mockResolvedValue(false as never);
      await expect(
        auth.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh (rotation)', () => {
    const future = new Date(Date.now() + 60_000);

    it('revokes the presented token and issues a new pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        tokenHash: 'hashed',
        revokedAt: null,
        expiresAt: future,
        user: { id: 'u1', email: 'a@b.com' },
      });
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const tokens = await auth.refresh('rt-old.secret');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-old' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tokens.accessToken).toBe('access.jwt.token');
      expect(tokens.refreshToken).toMatch(/^rt-1\./);
    });

    it('rejects a malformed token', async () => {
      await expect(auth.refresh('no-dot')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(auth.refresh('rt.secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an already-revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt',
        tokenHash: 'hashed',
        revokedAt: new Date(),
        expiresAt: future,
        user: { id: 'u1', email: 'a@b.com' },
      });
      await expect(auth.refresh('rt.secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt',
        tokenHash: 'hashed',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', email: 'a@b.com' },
      });
      await expect(auth.refresh('rt.secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the secret does not match the stored hash', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt',
        tokenHash: 'hashed',
        revokedAt: null,
        expiresAt: future,
        user: { id: 'u1', email: 'a@b.com' },
      });
      mockedBcrypt.compare.mockResolvedValue(false as never);
      await expect(auth.refresh('rt.wrong-secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the token by id', async () => {
      await auth.logout('rt-xyz.secret');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-xyz' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is a no-op for a malformed token', async () => {
      await auth.logout('');
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });
});
