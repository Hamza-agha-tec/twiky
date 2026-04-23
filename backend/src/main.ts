import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const frontendUrls = (process.env.FRONTEND_URLS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: frontendUrls,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3500);
}
bootstrap();
