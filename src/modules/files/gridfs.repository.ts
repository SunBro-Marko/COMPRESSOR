import { ObjectID } from 'bson';
import * as fs from 'fs';
import {
  GridFSBucket,
  GridFSBucketReadStream,
  GridFSFile,
  FindOptions,
} from 'mongodb';
import osTmpdir = require('os-tmpdir');
import { Stream } from 'stream';
import uniqueFilename = require('unique-filename');

import { Connection, Collection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

export interface IGridFSObject {
  _id: ObjectID;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  md5: string;
  filename: string;
  contentType: string;
  metadata: object;
}

export interface Metadata {
  [key: string]: any;
  container: string;
}

export interface IGridFSWriteOption {
  filename: string;
  chunkSizeBytes?: number;
  metadata?: Metadata;
  contentType?: string;
  aliases?: string[];
}

export interface IGridFSWriteOptionWithId {
  id: ObjectID;
  filename: string;
  chunkSizeBytes?: number;
  metadata?: any;
  contentType?: string;
  aliases?: string[];
}

export interface IDownloadOptions {
  filename: boolean | string;
  targetDir?: string;
}

export interface IDownloadStreamWithDocument {
  document: GridFSFile;
  stream: GridFSBucketReadStream;
}

export class GridFSRepository {
  constructor(
    @InjectConnection('gridFS') private connection: Connection,
    public readonly bucketName: string = 'fs',
  ) {}

  get bucket(): GridFSBucket {
    return new GridFSBucket(this.connection.db, {
      bucketName: this.bucketName,
    });
  }

  get filesCollection() {
    return this.connection.db.collection('fs.files');
  }

  getDownloadPath(
    object: GridFSFile,
    options: IDownloadOptions = {
      filename: false,
    },
  ) {
    let finalPath = '';
    if (!options.targetDir) {
      if (typeof options.filename === 'string') {
        finalPath = `${osTmpdir()}/${options.filename}`;
      } else {
        if (options.filename === true) {
          finalPath = `${osTmpdir()}/${object._id}`;
        } else {
          finalPath = uniqueFilename(osTmpdir());
        }
      }
    } else {
      if (typeof options.filename === 'string') {
        finalPath = `${options.targetDir}/${options.filename}`;
      } else {
        if (options.filename === true) {
          finalPath = object.filename;
        } else {
          finalPath = uniqueFilename(options.targetDir);
        }
      }
    }
    return finalPath;
  }

  /**
   * Returns a stream of a file from the GridFS.
   * @param {string} id
   * @return {Promise<GridFSBucketReadStream>}
   */
  async readFileStream(id: string): Promise<GridFSBucketReadStream> {
    const object = await this.findById(id);
    return this.bucket.openDownloadStream(object._id);
  }

  /**
   * Returns a stream of a file from the GridFS.
   * @param {string} id
   * @return {Promise<GridFSBucketReadStream>}
   */
  async readFileStreamWithDocument(
    id: string,
  ): Promise<IDownloadStreamWithDocument> {
    const document = await this.findById(id);
    return { document, stream: this.bucket.openDownloadStream(document._id) };
  }

  /**
   * Save the File from the GridFs to the filesystem and get the Path back
   * @param {string} id
   * @param {IDownloadOptions} options
   * @return {Promise<string>}
   */
  async downloadFile(id: string, options?: IDownloadOptions): Promise<string> {
    const object = await this.findById(id);
    const downloadPath = this.getDownloadPath(object, options);
    return new Promise<string>(async (resolve, reject) => {
      this.bucket
        .openDownloadStream(object._id)
        .once('error', async (error) => {
          reject(error);
        })
        .once('end', async () => {
          resolve(downloadPath);
        })
        .pipe(fs.createWriteStream(downloadPath, {}));
    });
  }

  /**
   * Find a single object by id
   * @param {string} id
   * @return {Promise<IGridFSObject>}
   */
  async findById(id: string): Promise<GridFSFile> {
    return await this.findOne({ _id: new ObjectID(id) });
  }

  /**
   * Find a single object by condition
   * @param filter
   * @return {Promise<IGridFSObject>}
   */
  async findOne(filter: any): Promise<GridFSFile> {
    const result = await this.find(filter);
    if (result.length === 0) {
      throw new Error('No Object found');
    }
    return result[0];
  }

  /**
   * Find a list of object by condition
   * @param filter
   * @return {Promise<IGridFSObject[]>}
   */
  async getAllFileTypes(): Promise<any> {
    const filesTypes = await this.filesCollection.distinct('metadata.mimetype');
    return filesTypes;
  }

  /**
   * Find a list of object by condition
   * @param filter
   * @return {Promise<IGridFSObject[]>}
   */
  async getTotalFilesSizeAndCount(
    filter: any,
    options?: FindOptions,
  ): Promise<any[]> {
    const files = <any>await this.filesCollection
      .aggregate(
        [
          { $match: filter },
          {
            $group: {
              _id: '$metadata.mimetype',
              count: { $sum: 1 },
              totalSize: { $sum: '$length' },
            },
          },
        ],
        options,
      )
      .toArray();
    return files;
  }

  /**
   * Find a list of object by condition
   * @param filter
   * @return {Promise<IGridFSObject[]>}
   */
  async find(filter: any, options?: FindOptions): Promise<IGridFSObject[]> {
    const files = <IGridFSObject[]>(
      await this.filesCollection.find(filter, options).toArray()
    );
    return files;
  }

  /**
   * Find a list of object by condition
   * @param filter
   * @return {Promise<IGridFSObject[]>}
   */
  async count(filter: any, options?: FindOptions): Promise<void | number> {
    return await this.filesCollection.count(filter, options);
  }

  /**
   * Find objects by condition
   * @param stream
   * @param options
   */
  writeFileStream(
    stream: Stream,
    options: IGridFSWriteOption,
  ): Promise<IGridFSObject> {
    return new Promise((resolve, reject) =>
      stream
        .pipe(
          this.bucket.openUploadStream(options.filename, {
            aliases: options.aliases,
            chunkSizeBytes: options.chunkSizeBytes,
            contentType: options.contentType,
            metadata: options.metadata,
          }),
        )
        .on('error', async (err) => {
          reject(err);
        })
        .on('finish', async (item: IGridFSObject) => {
          resolve(item);
        }),
    );
  }

  /**
   * Find objects by condition
   * @param stream
   * @param options
   */
  writeFileStreamWithId(
    stream: Stream,
    options: IGridFSWriteOptionWithId,
  ): Promise<IGridFSObject> {
    return new Promise((resolve, reject) =>
      stream
        .pipe(
          this.bucket.openUploadStreamWithId(options.id, options.filename, {
            aliases: options.aliases,
            chunkSizeBytes: options.chunkSizeBytes,
            contentType: options.contentType,
            metadata: options.metadata,
          }),
        )
        .on('error', async (err) => {
          reject(err);
        })
        .on('finish', async (item: IGridFSObject) => {
          resolve(item);
        }),
    );
  }

  /**
   * Upload a file directly from a fs Path
   * @param {string} uploadFilePath
   * @param {IGridFSWriteOption} options
   * @param {boolean} deleteFile
   * @return {Promise<IGridFSObject>}
   */
  async uploadFile(
    uploadFilePath: string,
    options: IGridFSWriteOption,
    deleteFile = Boolean(true),
  ): Promise<IGridFSObject> {
    if (!fs.existsSync(uploadFilePath)) {
      throw new Error('File not found');
    }
    const tryDeleteFile = (obj?: any): any => {
      if (fs.existsSync(uploadFilePath) && deleteFile === true) {
        fs.unlinkSync(uploadFilePath);
      }
      return obj;
    };
    return await this.writeFileStream(
      fs.createReadStream(uploadFilePath),
      options,
    )
      .then(tryDeleteFile)
      .catch((err) => {
        tryDeleteFile();
        throw err;
      });
  }

  /**
   * Upload a file directly from a fs Path
   * @param {string} uploadFilePath
   * @param {IGridFSWriteOption} options
   * @param {boolean} deleteFile
   * @return {Promise<IGridFSObject>}
   */
  async uploadFileById(
    uploadFilePath: string,
    options: IGridFSWriteOptionWithId,
    deleteFile = Boolean(true),
  ): Promise<IGridFSObject> {
    if (!fs.existsSync(uploadFilePath)) {
      throw new Error('File not found');
    }
    const tryDeleteFile = (obj?: any): any => {
      if (fs.existsSync(uploadFilePath) && deleteFile === true) {
        fs.unlinkSync(uploadFilePath);
      }
      return obj;
    };
    return await this.writeFileStreamWithId(
      fs.createReadStream(uploadFilePath),
      options,
    )
      .then(tryDeleteFile)
      .catch((err) => {
        // tryDeleteFile(); А вот не надо удалять файл при неудачной попытке записи !
        throw err;
      });
  }

  /**
   * Delete an File from the GridFS
   * @param {string} id
   * @return {Promise<boolean>}
   */
  async delete(id: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.bucket.delete(new ObjectID(id), async (err) => {
        if (err) {
          reject(err);
        }
        resolve(true);
      });
    });
  }
}
