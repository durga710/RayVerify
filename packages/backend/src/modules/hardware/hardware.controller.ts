import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HardwareRegistryService } from './hardware-registry.service';

@ApiTags('hardware')
@ApiBearerAuth('jwt')
@Controller('hardware')
export class HardwareController {
  constructor(private readonly registry: HardwareRegistryService) {}

  @Get('capabilities')
  @ApiOperation({
    summary: 'List supported hardware capabilities and registered drivers',
  })
  capabilities() {
    return this.registry.catalog();
  }
}
