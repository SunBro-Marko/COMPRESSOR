import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import configuration from './configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Mongo gridFS compressor')
    .setDescription('This is a mongo gridFS compressor')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('explorer', app, document);
  await app.listen(configuration.api.port);

  Logger.debug(
    `🔥 App was started on port: http://localhost:${configuration.api.port}/`,
    'MainModule',
  );
  Logger.debug(
    `💃 Test API: http://localhost:${configuration.api.port}/explorer/`,
    'MainModule',
  );
}
bootstrap();
