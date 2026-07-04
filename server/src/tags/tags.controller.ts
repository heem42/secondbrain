import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { CreateTagDto, LinkTagDto, UpdateTagDto } from './dto/tag.dto';
import { TagsService } from './tags.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get('tags')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tags.findAllForUser(user.id);
  }

  @Post('tags')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTagDto) {
    return this.tags.create(user.id, dto);
  }

  @Patch('tags/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tags.update(user.id, id, dto);
  }

  @Delete('tags/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tags.remove(user.id, id);
  }

  // ---- task ⇄ tag links -----------------------------------------------------

  @Post('task-tags')
  link(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkTagDto) {
    return this.tags.linkTag(user.id, dto.taskId, dto.tagId);
  }

  @Delete('task-tags/:taskId/:tagId')
  @HttpCode(204)
  unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.tags.unlinkTag(user.id, taskId, tagId);
  }
}
