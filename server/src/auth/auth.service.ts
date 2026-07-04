import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types';

const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; displayName: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create a user and bootstrap their private Inbox list in one transaction.
   * This replaces the Supabase `handle_new_user` trigger + `is_inbox` list
   * (ARCHITECTURE.md §5: signup creates the Inbox the smart list reads from).
   */
  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const displayName = dto.displayName ?? email.split('@')[0];

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, displayName },
        select: { id: true, email: true, displayName: true },
      });
      await tx.taskList.create({
        data: {
          ownerId: created.id,
          name: 'Inbox',
          isInbox: true,
          sortOrder: 0,
        },
      });
      return created;
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { ...tokens, user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Compare against a real-or-dummy hash either way to avoid leaking which
    // emails exist via response timing.
    const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  /**
   * Rotate a refresh token: validate the presented one, revoke it, and issue a
   * fresh pair (ARCHITECTURE.md §12: rotation + DB-backed revocation).
   */
  async refresh(presented: string): Promise<AuthTokens> {
    const [tokenId, secret] = presented.split('.');
    if (!tokenId || !secret) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(secret, record.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.user.id, record.user.email);
  }

  async logout(presented: string): Promise<void> {
    const [tokenId] = presented.split('.');
    if (!tokenId) return;
    await this.prisma.refreshToken
      .update({ where: { id: tokenId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });

    // Opaque refresh token: `<rowId>.<secret>`. Only the bcrypt hash of the
    // secret is stored, so a DB leak can't be used to mint access tokens.
    const secret = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const record = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
      select: { id: true },
    });

    return { accessToken, refreshToken: `${record.id}.${secret}` };
  }

  private refreshTtlMs(): number {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const perUnit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * perUnit[unit as keyof typeof perUnit];
  }
}
