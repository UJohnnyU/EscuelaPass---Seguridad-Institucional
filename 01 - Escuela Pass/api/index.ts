import express, { type Request, type Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';

const server = express();
let isBootstrapped = false;

async function bootstrap() {
  if (isBootstrapped) return;

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true
  });

  app.setGlobalPrefix('api/v1');
  await app.init();
  isBootstrapped = true;
}

export default async function handler(req: Request, res: Response) {
  await bootstrap();
  return server(req, res);
}
