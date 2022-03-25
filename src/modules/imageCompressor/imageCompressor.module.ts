import { Module } from '@nestjs/common';
import { ImageCompressorService } from './imageCompressor.service';

@Module({
  providers: [ImageCompressorService],
  exports: [ImageCompressorService],
})
export class ImageCompressorModule {}
