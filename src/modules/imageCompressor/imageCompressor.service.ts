import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { fromBuffer, fromStream } from 'file-type';

@Injectable()
export class ImageCompressorService {
  constructor() {
    //
  }
  private quality = 55; // хотелось бы readony
  private maxHeight = 2000; // хотелось бы readony
  private minSize = 500000; // В байтах

  readonly validTypes = [
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/png',
    'image/svg+xml',
    'image/tiff',
    'image/avif',
  ];

  isFileTypeValid(fileType) {
    return this.validTypes.includes(fileType);
  }

  async getMetaDataFromBuffer(buffer) {
    const { mime: fileType } = await fromBuffer(buffer);
    if (!this.isFileTypeValid(fileType)) {
      return null;
    }
    const image = sharp(buffer);
    const { height, width, size } = await image.metadata();
    return { height, width, size };
  }

  async compressBuffer(buffer) {
    const { mime: fileType } = await fromBuffer(buffer);
    if (!this.isFileTypeValid(fileType)) {
      return { isCompressed: false, buffer };
    }
    try {
      const image = sharp(buffer);
      const { height, size } = await this.getMetaDataFromBuffer(buffer);
      if (size <= this.minSize) {
        return { isCompressed: false, buffer };
      }
      const compressed = await image
        .resize(null, height <= this.maxHeight ? height : this.maxHeight)
        .jpeg({ quality: this.quality })
        .toBuffer();
      return {
        isCompressed: true,
        isResized: height > this.maxHeight,
        buffer: compressed,
      };
    } catch (error) {
      const logger = global.app.models.Log;
      logger.LogData({});
    }
  }

  getCompressPipe() {
    const compressPipe = sharp()
      .resize(null, this.maxHeight)
      .jpeg({ quality: this.quality });
    return compressPipe;
  }
}