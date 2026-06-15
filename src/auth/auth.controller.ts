import { Controller, Get, Query } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Controller('auth')
export class AuthController {
  @Get('token')
  getToken(@Query('domain') domain: string) {
    if (!domain) {
      throw new Error('domain query parameter is required');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in .env');
    }

    // Create a short-lived token (e.g., 5 minutes)
const token = jwt.sign({ domain }, secret, { expiresIn: '5m' });
    return { token };
  }
}