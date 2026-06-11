import { Module } from '@nestjs/common';
import { FraudController } from './fraud.controller';
import { FraudService } from './fraud.service';
import { FraudScoringService } from './fraud-scoring.service';

@Module({
  controllers: [FraudController],
  providers: [FraudService, FraudScoringService],
  exports: [FraudService, FraudScoringService],
})
export class FraudModule {}
