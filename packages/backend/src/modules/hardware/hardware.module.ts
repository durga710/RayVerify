import { Module } from '@nestjs/common';
import { HardwareController } from './hardware.controller';
import { HardwareRegistryService } from './hardware-registry.service';

@Module({
  controllers: [HardwareController],
  providers: [HardwareRegistryService],
  exports: [HardwareRegistryService],
})
export class HardwareModule {}
