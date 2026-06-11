import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'state-pi', description: 'Tenant (organization) slug' })
  @IsString()
  organizationSlug!: string;

  @ApiProperty({ example: 'investigator@state-pi.gov' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false, description: 'TOTP/SMS code when MFA enabled' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty()
  refreshToken!: string;
  @ApiProperty()
  expiresIn!: number;
  @ApiProperty()
  tokenType = 'Bearer';
}
