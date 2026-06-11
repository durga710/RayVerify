import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { IdentityService } from './identity.service';
import { VerifyIdentityDto } from './dto/identity.dto';

@ApiTags('identity')
@ApiBearerAuth('jwt')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('verify')
  @RequirePermissions('identity:verify')
  @ApiOperation({
    summary: 'Run selfie + liveness identity verification for a caregiver',
  })
  verify(@Body() dto: VerifyIdentityDto) {
    return this.identity.verify(dto);
  }
}
