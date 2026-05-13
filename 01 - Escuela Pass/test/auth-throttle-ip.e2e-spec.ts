import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(60000);

const strictIpThrottle = process.env.AUTH_THROTTLE_LIMIT === '5';

(strictIpThrottle ? describe : describe.skip)(
  'Auth throttle IP (ejecutar: node test/run-auth-throttle-e2e.cjs)',
  () => {
    let app: INestApplication;
    const apiPrefix = process.env.API_PREFIX ?? 'api/v1';

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule]
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix(apiPrefix);
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true
        })
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('login con credenciales inválidas repeticiones terminan en 429', async () => {
      const fakeEmail = `throttle-ip.${Date.now()}@example.com`;
      let saw429 = false;
      for (let i = 0; i < 10; i++) {
        const res = await request(app.getHttpServer())
          .post(`/${apiPrefix}/auth/login`)
          .send({ email: fakeEmail, password: 'bad-password' });
        if (res.status === 429) {
          saw429 = true;
          break;
        }
      }
      expect(saw429).toBe(true);
    });
  }
);
