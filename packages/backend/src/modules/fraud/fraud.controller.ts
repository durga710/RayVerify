import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { FraudService } from './fraud.service';
import { ListFraudEventsQueryDto } from './dto/fraud.dto';

@ApiTags('fraud')
@ApiBearerAuth('jwt')
@Controller('fraud')
export class FraudController {
  constructor(private readonly fraud: FraudService) {}

  @Get('events')
  @RequirePermissions('fraud_event:read')
  @ApiOperation({ summary: 'List fraud events (filterable by type)' })
  async listEvents(@Query() query: ListFraudEventsQueryDto) {
    const { data, total } = await this.fraud.listEvents({
      type: query.type,
      skip: query.skip,
      take: query.take,
    });
    return paginate(data, total, query);
  }

  @Post('visits/:id/score')
  @RequirePermissions('fraud:score')
  @ApiOperation({
    summary: 'Run the fraud detectors against a visit and persist events + score',
  })
  scoreVisit(@Param('id', ParseUUIDPipe) id: string) {
    return this.fraud.scoreVisit(id);
  }
}
