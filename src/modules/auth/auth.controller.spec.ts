import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refresh: jest.Mock;
    getSafeUser: jest.Mock;
  };

  function mockResponse(): jest.Mocked<Response> {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as jest.Mocked<Response>;
  }

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      refresh: jest.fn(),
      getSafeUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('sets both access_token and refresh_token cookies, with refresh_token scoped to /api/auth', async () => {
      const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' };
      authService.login.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com' }, tokens });
      const res = mockResponse();

      const result = await controller.login({ email: 'a@b.com', password: 'secret1' }, res);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-123',
        expect.objectContaining({ path: '/', httpOnly: true }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-456',
        expect.objectContaining({ path: '/api/auth', httpOnly: true }),
      );
      expect(result).toEqual({
        data: {
          user: { id: 'u1', email: 'a@b.com' },
          accessToken: 'access-123',
          refreshToken: 'refresh-456',
        },
      });
    });
  });

  describe('logout', () => {
    it('clears both the access_token and refresh_token cookies', () => {
      const res = mockResponse();

      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/auth' }),
      );
      expect(result).toEqual({ data: { message: 'Logged out successfully.' } });
    });

    it('does not leak maxAge on the clear options (must match set options minus maxAge)', () => {
      const res = mockResponse();

      controller.logout(res);

      const accessCallOptions = (res.clearCookie as jest.Mock).mock.calls.find(
        ([name]) => name === 'access_token',
      )?.[1];
      const refreshCallOptions = (res.clearCookie as jest.Mock).mock.calls.find(
        ([name]) => name === 'refresh_token',
      )?.[1];

      expect(accessCallOptions).not.toHaveProperty('maxAge');
      expect(refreshCallOptions).not.toHaveProperty('maxAge');
    });
  });

  describe('refresh', () => {
    it('reads the refresh token from the refresh_token cookie when no body token is given', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      authService.refresh.mockResolvedValue(tokens);
      const res = mockResponse();
      const req = { cookies: { refresh_token: 'cookie-refresh-token' } } as unknown as Request;

      const result = await controller.refresh({}, req, res);

      expect(authService.refresh).toHaveBeenCalledWith('cookie-refresh-token');
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'new-access', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.objectContaining({ path: '/api/auth' }),
      );
      expect(result).toEqual({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } });
    });

    it('prefers the cookie token over a body token when both are present', async () => {
      authService.refresh.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });
      const res = mockResponse();
      const req = { cookies: { refresh_token: 'cookie-token' } } as unknown as Request;

      await controller.refresh({ refreshToken: 'body-token' }, req, res);

      expect(authService.refresh).toHaveBeenCalledWith('cookie-token');
    });

    it('falls back to the body token when no cookie is present', async () => {
      authService.refresh.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });
      const res = mockResponse();
      const req = { cookies: {} } as unknown as Request;

      await controller.refresh({ refreshToken: 'body-token' }, req, res);

      expect(authService.refresh).toHaveBeenCalledWith('body-token');
    });

    it('throws UnauthorizedException when neither a cookie nor a body token is present', async () => {
      const res = mockResponse();
      const req = { cookies: {} } as unknown as Request;

      await expect(controller.refresh({}, req, res)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });
});
