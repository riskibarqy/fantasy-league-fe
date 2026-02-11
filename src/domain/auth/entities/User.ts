export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
};

export type LoginCredentials = {
  email: string;
  password: string;
};
