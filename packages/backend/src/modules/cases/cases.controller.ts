import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { CaseStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CasesService } from './cases.service';
import {
  AddNoteDto,
  AssignCaseDto,
  CreateCaseDto,
  UpdateCaseStatusDto,
} from './dto/cases.dto';

class ListCasesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CaseStatus })
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}

@ApiTags('cases')
@ApiBearerAuth('jwt')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Post()
  @RequirePermissions('fraud_case:create')
  @ApiOperation({ summary: 'Open an investigation case (optionally link events)' })
  create(@Body() dto: CreateCaseDto) {
    return this.cases.create(dto);
  }

  @Get()
  @RequirePermissions('fraud_case:read')
  @ApiOperation({ summary: 'List cases (priority-ordered)' })
  async list(@Query() query: ListCasesQueryDto) {
    const { data, total } = await this.cases.list({
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
    return paginate(data, total, query);
  }

  @Get(':id')
  @RequirePermissions('fraud_case:read')
  @ApiOperation({ summary: 'Case detail: events, notes, evidence, timeline' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cases.findOne(id);
  }

  @Patch(':id/assign')
  @RequirePermissions('fraud_case:assign')
  @ApiOperation({ summary: 'Assign a case to an investigator' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignCaseDto) {
    return this.cases.assign(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('fraud_case:update')
  @ApiOperation({ summary: 'Update case status (substantiate/close/escalate)' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseStatusDto) {
    return this.cases.updateStatus(id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions('fraud_case:update')
  @ApiOperation({ summary: 'Add an investigator note' })
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddNoteDto) {
    return this.cases.addNote(id, dto);
  }
}
