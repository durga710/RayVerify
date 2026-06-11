import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('jwt')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s notifications' })
  async list(@Query() query: PaginationQueryDto) {
    const { data, total } = await this.notifications.listForCurrentUser({ skip: query.skip, take: query.take });
    return paginate(data, total, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification read' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(id);
  }
}
