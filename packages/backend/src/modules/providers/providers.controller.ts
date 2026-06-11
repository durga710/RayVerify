import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ProvidersService } from './providers.service';

@ApiTags('providers')
@ApiBearerAuth('jwt')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get('risk-ranking')
  @RequirePermissions('provider:read')
  @ApiOperation({ summary: 'Provider risk ranking (highest risk first)' })
  async ranking(@Query() query: PaginationQueryDto) {
    const { data, total } = await this.providers.ranking({ skip: query.skip, take: query.take });
    return paginate(data, total, query);
  }

  @Get(':id/risk-profile')
  @RequirePermissions('provider:read')
  @ApiOperation({ summary: 'Provider risk profile with historical trend' })
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.getProfile(id);
  }

  @Post(':id/risk-profile/recompute')
  @RequirePermissions('provider:score')
  @ApiOperation({ summary: 'Recompute a provider risk profile from current signals' })
  recompute(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.recompute(id);
  }
}
