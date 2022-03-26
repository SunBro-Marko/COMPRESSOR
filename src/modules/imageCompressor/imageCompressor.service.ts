import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageCompressorService {
  private readonly logger = new Logger(ImageCompressorService.name);
  constructor() {
    //
  }
  private quality = 60; // хотелось бы readony
  private maxHeight = 2000; // хотелось бы readony
  private minSize = 150000; // В байтах

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

  async getMetaDataFromBuffer(image) {
    // const { mime: fileType } = await fromBuffer(buffer);
    // if (!this.isFileTypeValid(fileType)) {
    //   return null;
    // }
    const { height, width, size } = await image.metadata();
    return { height, width, size };
  }

  async compressBuffer(buffer) {
    // const { mime: fileType } = await fromBuffer(buffer);
    // if (!this.isFileTypeValid(fileType)) {
    //   return { isCompressed: false, buffer };
    // }
    try {
      const image = sharp(buffer);
      const { height, size } = await this.getMetaDataFromBuffer(image);
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
      this.logger.error(error.message);
      throw error;
    }
  }

  getCompressPipe(fileMeta) {
    const compressPipe = sharp()
      .resize(
        null,
        fileMeta.data.height <= this.maxHeight
          ? fileMeta.data.height
          : this.maxHeight,
      )
      .jpeg({ quality: this.quality });
    return compressPipe;
  }

  getMetaDataPipe(fileMeta) {
    return sharp().metadata((err, data) => {
      console.log(data);

      fileMeta['data'] = data;
    });
  }
}
