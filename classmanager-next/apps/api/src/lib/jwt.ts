import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

import type { AppEnv } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  username: string;
};

export type RefreshTokenPayload = {
  sub: string;
  type: "refresh";
};

export function signAccessToken(payload: AccessTokenPayload, env: AppEnv) {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...options
  });
}

export function signRefreshToken(payload: RefreshTokenPayload, env: AppEnv) {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...options
  });
}

export function verifyAccessToken(token: string, env: AppEnv) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string, env: AppEnv) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
