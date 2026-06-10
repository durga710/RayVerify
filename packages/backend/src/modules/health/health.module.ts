import { Controller, Get } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'rayverify-api', time: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
