import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ImageCompressorService } from '../imageCompressor/imageCompressor.service';
import { GridFSRepository } from './gridfs.repository';
import { Types } from 'mongoose';
import { promises as fsPromises } from 'fs';
import { Stream } from 'stream';
import md5File from 'md5-file';

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
    for (let i = 0; i < 10; i++) {
      const newFile = await this.gridFSRepository.uploadFile(
        catsPictureURI,
        {
          filename: `TheCat${i + 1}.jpg`,
          metadata: { container: 'cats', mimetype: 'image/jpeg' },
        },
        false,
      );
      this.logger.log(`Uploded ${newFile.filename}`);
    }
    return 'Ваша база полна котов Сэр !';
  }
  //482 в минуту

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
    try {
      const { document, stream: readFileStream } =
        await this.gridFSRepository.readFileStreamWithDocument(id);

      const documentWithMd5 = { md5: null, ...document };

      const tempPath = `src/modules/files/tmp/${document._id}`;
      const tempFile = `src/modules/files/tmp/${document._id}.json`;

      const fileBuffer = await this.stream2buffer(readFileStream);

      const compressedFile = await this.imageCompressorService.compressBuffer(
        fileBuffer,
      );

      await fsPromises.writeFile(tempPath, compressedFile.buffer);

      await fsPromises.writeFile(tempFile, JSON.stringify(documentWithMd5));

      // Удаляем файл из gridfs
      await this.gridFSRepository.delete(id);

      // Вычисляем ХЭШ файла
      const md5 = await md5File(tempPath);

      // Загружаем уже сжатый файл в gridfs бех удаления файла с диска
      const newFile = await this.gridFSRepository.uploadFileById(
        tempPath,
        {
          id: new Types.ObjectId(document._id),
          filename: `${document.filename}`,
          contentType: document.contentType || document?.metadata?.mimetype,
          metadata: {
            ...document.metadata,
            isCompressed: true,
            md5,
            oldMd5: documentWithMd5?.md5 || null,
          },
        },
        true,
      );

      // Удаляем сохранённые временные файлы
      await fsPromises.unlink(tempFile);
      return newFile;
    } catch (e) {
      this.logger.error(e.message);
    }
  }

  async compressAllFilesByType(type: string): Promise<void> {
    const filetypeFilter = {
      'metadata.mimetype': type,
      'metadata.isCompressed': { $exists: false },
    };

    const files = this.gridFSRepository.getCursor(filetypeFilter, {
      sort: { _id: -1 },
    });

    let count = 0;
    let totalFreedSpace = 0;
    const startTime = Date.now();
    for await (const file of <any>files) {
      const oldSize = file.length;
      const newFile = await this.compressFileById(file._id);
      if (!newFile) {
        this.logger.error(`Не удалось сжать файл ${file._id}`);
        continue;
      }
      const newSize = newFile.length;
      totalFreedSpace = totalFreedSpace + oldSize - newSize;
      ++count;
      this.logger.debug(
        `${count} files compressed,${(totalFreedSpace / 1024 / 1024).toFixed(
          2,
        )} MB freed, last file id: ${file._id}`,
      );
    }
    const endTime = Date.now();
    console.log(`Время выполнения: ${(endTime - startTime) / 60000} минут`);
    return;
  }

  async restoreFileFromTempById(id) {
    const tempPath = `src/modules/files/tmp/${id}`;
    const tempFile = `src/modules/files/tmp/${id}.json`;
    const data = await fsPromises.readFile(tempFile, {
      encoding: 'utf8',
    });
    const document = JSON.parse(data);
    // Вычисляем ХЭШ файла
    const md5 = await md5File(tempPath);

    // Загружаем уже сжатый файл в gridfs бех удаления файла с диска
    const newFile = await this.gridFSRepository.uploadFileById(
      tempPath,
      {
        id: new Types.ObjectId(document._id),
        filename: `${document.filename}`,
        contentType: document.contentType || document?.metadata?.mimetype,
        metadata: {
          ...document.metadata,
          isCompressed: true,
          md5,
          oldMd5: document?.md5 || null,
        },
      },
      true,
    );

    // Удаляем сохранённые временные файлы
    await fsPromises.unlink(tempFile);
    return newFile;
  }

  async replaceFileById(id) {
    try {
      // Пробуем найти данный файл в базе данных
      const { document, stream: readFileStream } =
        await this.gridFSRepository.readFileStreamWithDocument(id);

      // Определяем константы путей
      const newFilePath = `src/modules/files/replace/${id}`;
      const oldDocumentFile = `src/modules/files/replace/recovery/${id}`;
      const oldDocument = `src/modules/files/replace/recovery/${id}.json`;

      const documentWithMd5 = { md5: null, ...document };

      // Запишем в recovery старый файл и его мета данные
      await fsPromises.writeFile(
        oldDocumentFile,
        await this.stream2buffer(readFileStream),
      );
      await fsPromises.writeFile(oldDocument, JSON.stringify(documentWithMd5));

      // Вычисляем ХЭШ сжатого файла
      const md5 = await md5File(newFilePath);

      // Удаляем файл из gridfs
      await this.gridFSRepository.delete(id);
      // Загружаем уже сжатый файл в gridfs бех удаления файла с диска
      const newFile = await this.gridFSRepository.uploadFileById(
        newFilePath,
        {
          id: new Types.ObjectId(document._id),
          filename: `${document.filename}`,
          contentType: document.contentType || document?.metadata?.mimetype,
          metadata: {
            ...document.metadata,
            md5,
            oldMd5: documentWithMd5?.md5 || null,
          },
        },
        true,
      );
      return newFile;
    } catch (e) {
      this.logger.error(e);
      return `Не удалось заменить файл.`;
    }
  }

  async stream2buffer(stream: Stream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const _buf = Array<any>();

      stream.on('data', (chunk) => _buf.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(_buf)));
      stream.on('error', (err) => reject(`error converting stream - ${err}`));
    });
  }
}
