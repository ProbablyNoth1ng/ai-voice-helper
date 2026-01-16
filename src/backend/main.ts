import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  logger.log('🚀 Starting Backend...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug']
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true
  }));

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  });

  const port = process.env.BACKEND_PORT || 3002;
  
  await app.listen(port, '0.0.0.0');
  
  logger.log(`✅ HTTP Server: http://localhost:${port}`);
  logger.log(`✅ WebSocket: ws://localhost:3001`);
  
  return app;
}

bootstrap().catch(err => {
  console.error('❌ Failed to start:', err);
  process.exit(1);
});

export { bootstrap };