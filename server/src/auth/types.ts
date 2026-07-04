/** Shape of a decoded access-token payload. `sub` is the user id (JWT convention). */
export interface JwtPayload {
  sub: string;
  email: string;
}

/** The authenticated principal attached to `request.user` by JwtStrategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
