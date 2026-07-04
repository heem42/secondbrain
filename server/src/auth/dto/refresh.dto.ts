import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Optional: the web client sends the refresh token via an httpOnly cookie
  // instead of the body. iOS still sends it here.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
