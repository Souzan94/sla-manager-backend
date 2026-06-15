import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key']; // header sent from client

    if (!apiKey || apiKey !== process.env.API_KEY) {
      throw new UnauthorizedException('Invalid API Key');
    }

    return true;
  }
}