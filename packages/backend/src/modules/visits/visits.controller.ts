import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { VisitStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { VisitsService } from './visits.service';
import { ClockEventDto, ClockOutDto, CreateVisitDto } from './dto/visits.dto';

class ListVisitsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;
}

@ApiTags('visits')
@ApiBearerAuth('jwt')
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post()
  @RequirePermissions('visit:create')
  @ApiOperation({ summary: 'Schedule/create a visit' })
  create(@Body() dto: CreateVisitDto) {
    return this.visits.create(dto);
  }

  @Get()
  @RequirePermissions('visit:read')
  @ApiOperation({ summary: 'List visits' })
  async list(@Query() query: ListVisitsQueryDto) {
    const { data, total } = await this.visits.list({
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
    return paginate(data, total, query);
  }

  @Get(':id')
  @RequirePermissions('visit:read')
  @ApiOperation({ summary: 'Get a visit with its full verification package' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.visits.findOne(id);
  }

  @Post(':id/clock-in')
  @RequirePermissions('visit:clock')
  @ApiOperation({ summary: 'Record clock-in (GPS + device evidence)' })
  clockIn(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClockEventDto) {
    return this.visits.clockIn(id, dto);
  }

  @Post(':id/clock-out')
  @RequirePermissions('visit:clock')
  @ApiOperation({ summary: 'Record clock-out' })
  clockOut(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClockOutDto) {
    return this.visits.clockOut(id, dto);
  }

  @Post(':id/verify')
  @RequirePermissions('visit:verify')
  @ApiOperation({ summary: 'Run the verification chain and produce the rollup' })
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.visits.runVerificationChain(id);
  }
}
