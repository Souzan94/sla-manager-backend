import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // The frontend must send the token in the Authorization header as "Bearer <token>"
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid token format');
    }

    const token = tokenParts[1];

    try {
      // Verify token using the JWT_SECRET in your .env
   const payload = jwt.verify(token, process.env.JWT_SECRET!);
      // Optional: attach payload to request for use in controllers
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}