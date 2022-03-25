import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ImageCompressorService } from '../imageCompressor/imageCompressor.service';
import { GridFSRepository } from './gridfs.repository';
import util from 'util';
import stream from 'stream';
import * as fs from 'fs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly gridFSRepository: GridFSRepository,
    private readonly imageCompressorService: ImageCompressorService,
  ) {}

  async getAllFilesDocuments() {
    const files = await this.gridFSRepository.find({}, { skip: 0, limit: 10 });
    const count = await this.gridFSRepository.count({}, { skip: 0, limit: 10 });
    return { files, count };
  }

  async getAllFileTypes() {
    return this.gridFSRepository.getAllFileTypes();
  }

  async getAllFilesDocumentsByType(type: string) {
    const filetypeFilter = { 'metadata.mimetype': type };
    const files = await this.gridFSRepository.find(filetypeFilter, {
      skip: 0,
      limit: 10,
    });
    const count = await this.gridFSRepository.count(filetypeFilter, {
      skip: 0,
      limit: 10,
    });
    return { files, count };
  }

  async getTotalFilesSizeAndCount(): Promise<any> {
    return this.gridFSRepository.getTotalFilesSizeAndCount({});
  }

  async getTotalFilesSizeAndCountByType(type: string): Promise<any> {
    const filetypeFilter = { 'metadata.mimetype': type };
    return this.gridFSRepository.getTotalFilesSizeAndCount(filetypeFilter);
  }

  async UploadAThousandCats(): Promise<string> {
    const catsPictureURI = 'src/modules/files/test/TheCat.jpg';
    for (let i = 0; i < 1000; i++) {
      const newFile = await this.gridFSRepository.uploadFile(
        catsPictureURI,
        {
          filename: `TheCat${i}.jpg`,
          metadata: { container: 'cats', mimetype: 'image/jpeg' },
        },
        false,
      );
      this.logger.log(`Uploded ${newFile.filename}`);
    }
    return 'Ваша база полна котов Сэр !';
  }

  async downloadFileById(id: string, res: Response): Promise<StreamableFile> {
    const { document, stream } =
      await this.gridFSRepository.readFileStreamWithDocument(id);

    // Установка соответствущих заголовков для скачивания файла
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', document.length);
    res.setHeader(
      'Content-Type',
      document?.metadata?.mimetype || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURI(document.filename)}"`,
    );
    return new StreamableFile(stream);
  }

  async compressFileById(id: string): Promise<any> {
    this.logger.log(`> START compression file - ${id}`);
    const { document, stream: readFileStream } =
      await this.gridFSRepository.readFileStreamWithDocument(id);

    const tempPath = `src/modules/files/tmp/${document.filename}`;

    const writebleStream = fs.createWriteStream(tempPath);

    const compressionPipe = this.imageCompressorService.getCompressPipe();

    const pipeline = util.promisify(stream.pipeline);

    // Выгружаем файл на комп параллельно сжимая его
    await pipeline(readFileStream, compressionPipe, writebleStream);
    this.logger.log(
      `File ${document._id} has been downloaded to FS and compressed`,
    );

    // Создаём запись в базе данных с информацией о файле
    // Удаляем файл из gridfs
    await this.gridFSRepository.delete(id);
    this.logger.log(`Old file ${document._id} has been deleted from gridfs`);

    // Загружаем уже сжатый файл в gridfs бех удаления файла с диска
    const newFile = await this.gridFSRepository.uploadFileById(
      tempPath,
      {
        id: document._id,
        filename: `${document.filename}`,
        metadata: {
          container: 'compressed',
          mimetype: document.metadata.mimetype,
        },
      },
      true,
    );

    this.logger.log(
      `Compressed file ${document._id} has been uploaded to gridfs with id ${
        newFile._id
      } (isIDSame: ${newFile._id === document._id})`,
    );
    this.logger.log(`> END compression file - ${id}`);
    this.logger.log(`> `);
    return newFile;
  }
}
