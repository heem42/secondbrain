import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate every request body against its DTO (ARCHITECTURE.md §4, §6).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  // Cookies carry the refresh token for the web client (httpOnly). iOS keeps
  // using the JSON body, so this is purely additive.
  app.use(cookieParser());

  // Allow the web SPA origin(s) to call the API with credentials (the refresh
  // cookie). Comma-separated WEB_ORIGIN; defaults to the Vite dev server.
  const origins = config
    .get<string>('WEB_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}

void bootstrap();
