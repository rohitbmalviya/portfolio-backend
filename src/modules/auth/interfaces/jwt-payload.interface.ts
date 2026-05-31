export interface JwtPayload {
  sub: string;   // AdminUser.id
  email: string;
}

export interface JwtRefreshPayload extends JwtPayload {
  tokenType: 'refresh';
}
