import { Module } from '@nestjs/common';
import { CompressorService } from './compressor.service';

@Module({
  providers: [CompressorService],
})
export class CompressorModule {}
