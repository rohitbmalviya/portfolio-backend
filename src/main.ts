import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security & parsing
  app.use(helmet());
  app.use(cookieParser());

  // CORS — only the frontend origin(s)
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Global API prefix + validation
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (dev docs at /api/docs)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Portfolio API')
    .setDescription('Content + auth API for the portfolio (public reads, admin writes).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Cloud Run injects PORT (default 8080 in production) and requires the
  // process to bind ALL interfaces, not just localhost — Node's default
  // (no host arg) already binds all interfaces, but we set it explicitly
  // so this never silently regresses to '127.0.0.1'/'localhost' in some
  // future refactor.
  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 Portfolio API running on http://0.0.0.0:${port}/api`);
}

void bootstrap();
