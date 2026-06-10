import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateVisitDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() providerId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() caregiverId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() patientId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() authorizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceCode?: string;
  @ApiProperty() @IsDateString() scheduledStart!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledEnd?: string;
}

export class ClockEventDto {
  @ApiProperty({ minimum: -90, maximum: 90 }) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @ApiProperty({ minimum: -180, maximum: 180 }) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() accuracyMeters?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() capturedAt?: string;
  @ApiPropertyOptional({ description: 'Client device id' }) @IsOptional() @IsString() deviceId?: string;
}

export class ClockOutDto extends ClockEventDto {
  @ApiPropertyOptional({ description: 'Billed units for this visit' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  billedUnits?: number;
}
