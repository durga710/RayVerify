import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SimulateScoresDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  confidence?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  liveness?: number;
}

export class VerifyIdentityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  caregiverId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Associate with a visit' })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @ApiPropertyOptional({ description: 'S3 key of the captured selfie/probe image' })
  @IsOptional()
  @IsString()
  probeS3Key?: string;

  @ApiPropertyOptional({ description: 'Dev/demo override for matcher scores' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SimulateScoresDto)
  simulate?: SimulateScoresDto;
}
