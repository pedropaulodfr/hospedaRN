import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrls = (configService.get<string>('FRONTEND_URL', '') || '')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');

  // Security
  app.use(helmet());

  // CORS — produção (Vercel), previews e desenvolvimento local
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    ...frontendUrls,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      // Requisições server-to-server (curl, healthcheck) não enviam Origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);

      try {
        const { protocol, hostname } = new URL(origin);
        if (protocol === 'https:' && (hostname === 'hospeda-rn.vercel.app' || hostname.endsWith('.vercel.app'))) {
          return callback(null, true);
        }
      } catch {
        // Origin malformada: cai no bloqueio abaixo
      }

      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token', 'x-usuario-id'],
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED', 'true') === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(configService.get<string>('SWAGGER_TITLE', 'HospedaRN API'))
      .setDescription(
        configService.get<string>(
          'SWAGGER_DESCRIPTION',
          'API do sistema de hospedagens do Rio Grande do Norte',
        ),
      )
      .setVersion(configService.get<string>('SWAGGER_VERSION', '1.0'))
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Autenticação e autorização')
      .addTag('Usuarios', 'Gestão de usuários')
      .addTag('Cidades', 'Cidades turísticas do RN')
      .addTag('Estabelecimentos', 'Estabelecimentos de hospedagem')
      .addTag('Comodidades', 'Comodidades')
      .addTag('Accommodation Types', 'Tipos de acomodação')
      .addTag('Quartos', 'Quartos e acomodações')
      .addTag('Reservas', 'Reservas')
      .addTag('Pagamentos', 'Pagamentos')
      .addTag('Eventos', 'Eventos turísticos')
      .addTag('Avaliacoes', 'Avaliações')
      .addTag('Favoritos', 'Favoritos')
      .addTag('Maps', 'Mapas e geolocalização')
      .addTag('Reports', 'Relatórios')
      .addTag('Uploads', 'Upload de arquivos')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = configService.get<string>('SWAGGER_PATH', 'api/docs');
    SwaggerModule.setup(swaggerPath.replace('api/', ''), app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);
  console.log(`\n🏖️  HospedaRN API running on: http://localhost:${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger docs: http://localhost:${port}/docs\n`);
  }
}

bootstrap();
