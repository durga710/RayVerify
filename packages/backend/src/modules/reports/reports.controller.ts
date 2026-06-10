import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ReportFormat, ReportType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ReportsService } from './reports.service';

class RequestReportDto {
  @ApiProperty({ enum: ReportType }) @IsEnum(ReportType) type!: ReportType;
  @ApiPropertyOptional({ enum: ReportFormat }) @IsOptional() @IsEnum(ReportFormat) format?: ReportFormat;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() parameters?: Record<string, unknown>;
}

class ListReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReportType }) @IsOptional() @IsEnum(ReportType) type?: ReportType;
}

@ApiTags('reports')
@ApiBearerAuth('jwt')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @RequirePermissions('report:create')
  @ApiOperation({ summary: 'Queue a report (PDF/XLSX) for generation' })
  request(@Body() dto: RequestReportDto) {
    return this.reports.request(dto);
  }

  @Get()
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'List reports' })
  async list(@Query() query: ListReportsQueryDto) {
    const { data, total } = await this.reports.list({ type: query.type, skip: query.skip, take: query.take });
    return paginate(data, total, query);
  }

  @Get(':id')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'Get a report (status + download when READY)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.findOne(id);
  }
}
