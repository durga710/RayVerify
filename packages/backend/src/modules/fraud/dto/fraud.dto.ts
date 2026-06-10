import { ApiPropertyOptional } from '@nestjs/swagger';
import { FraudEventType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListFraudEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FraudEventType })
  @IsOptional()
  @IsEnum(FraudEventType)
  type?: FraudEventType;
}
