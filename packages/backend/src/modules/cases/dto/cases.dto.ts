import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CasePriority, CaseStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCaseDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional({ enum: CasePriority }) @IsOptional() @IsEnum(CasePriority) priority?: CasePriority;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() providerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional({ description: 'Fraud event ids to link on creation', type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  fraudEventIds?: string[];
  @ApiPropertyOptional({ description: 'Estimated exposure in cents' })
  @IsOptional() @IsInt() exposureCents?: number;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: CaseStatus }) @IsEnum(CaseStatus) status!: CaseStatus;
}

export class AssignCaseDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() assigneeId!: string;
}

export class AddNoteDto {
  @ApiProperty() @IsString() body!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() isInternal?: boolean;
}
