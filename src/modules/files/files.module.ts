import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { GridFSRepository } from './gridfs.repository';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ImageCompressorModule } from '../imageCompressor/imageCompressor.module';

const GridFSProvider = {
  provide: GridFSRepository,
  useFactory: (connection: Connection) => {
    return new GridFSRepository(connection);
  },
  inject: [getConnectionToken('gridFS')],
};

@Module({
  controllers: [FilesController],
  providers: [FilesService, GridFSRepository, GridFSProvider],
  imports: [ImageCompressorModule],
})
export class FilesModule {}
