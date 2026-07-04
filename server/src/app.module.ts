import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { ListsModule } from './lists/lists.module';
import { PrismaModule } from './prisma/prisma.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AccessModule,
    AuthModule,
    UsersModule,
    ListsModule,
    TasksModule,
    TagsModule,
  ],
})
export class AppModule {}
