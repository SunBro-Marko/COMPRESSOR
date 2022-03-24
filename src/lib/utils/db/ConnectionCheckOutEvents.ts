import { Logger } from '@nestjs/common';

const logsContext = 'MongooseModule';

export default function ConnectionCheckOutEvents(
  connection: any,
  dbName: string,
) {
  // connection.on('connected', () => {
  //   Logger.log(`${dbName} is connected`, logsContext);
  // });
  connection.on('disconnected', () => {
    Logger.error(`${dbName} disconnected`, logsContext);
  });
  // connection.on('error', (error) => {
  //   Logger.error(`${dbName} connection failed! for error: `, [
  //     error,
  //     logsContext,
  //   ]);
  // });
  return connection;
}
