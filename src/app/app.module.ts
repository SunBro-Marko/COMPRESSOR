import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from 'src/configuration';
import ConnectionCheckOutEvents from 'src/lib/utils/db/ConnectionCheckOutEvents';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import * as Modules from '../modules';

const dbUrl = configuration.database.mainDatabase;

const db = MongooseModule.forRoot(dbUrl, {
  autoIndex: configuration.isProduction,
  connectionFactory: ConnectionCheckOutEvents,
});

const gridfsStorageUrl = configuration.database.gridfsDatabase;
const gridfsStorage = MongooseModule.forRoot(gridfsStorageUrl, {
  connectionName: 'gridFS',
  autoIndex: configuration.isProduction,
  connectionFactory: ConnectionCheckOutEvents,
});

const modulesArray = Object.values(Modules);

@Module({
  imports: [db, gridfsStorage, ...modulesArray],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
