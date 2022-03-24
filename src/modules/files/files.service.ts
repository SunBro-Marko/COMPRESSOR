import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { MongoGridFS, IGridFSWriteOption } from 'mongo-gridfs';
import { Types, Connection } from 'mongoose';
import { Db, GridFSBucket, GridFSBucketReadStream } from 'mongodb';

@Injectable()
export class FilesService {
  constructor() {
    //
  }
}
