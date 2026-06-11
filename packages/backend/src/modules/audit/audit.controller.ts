import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from './audit.service';

class SearchAuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() resourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceId?: string;
  @ApiPropertyOptional({ enum: AuditAction }) @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
}

@ApiTags('audit')
@ApiBearerAuth('jwt')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Search the immutable audit trail' })
  async search(@Query() query: SearchAuditQueryDto) {
    const { data, total } = await this.audit.search({
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      action: query.action,
      skip: query.skip,
      take: query.take,
    });
    return paginate(data, total, query);
  }

  @Get('verify-chain')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Verify the tamper-evident audit hash chain' })
  verify() {
    return this.audit.verifyChain();
  }
}
