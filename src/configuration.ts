import * as dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
});

export default {
  isProduction: process.env.RUNNING_MOD === 'production' ? true : false,
  api: {
    port: process.env.PORT,
    version: process.env.VERSION,
  },
  database: {
    mainDatabase: process.env.MAIN_DATABASE,
    gridfsDatabase: process.env.GRIDFS_DATABASE,
  },
  adminUser: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  },
  log: {
    mode: process.env.LOG_MODE,
  },
};
