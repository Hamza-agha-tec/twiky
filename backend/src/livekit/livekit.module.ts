import { Module } from '@nestjs/common';
import { LiveKitController } from './livekit.controller';

@Module({
  controllers: [LiveKitController],
})
export class LiveKitModule {}
