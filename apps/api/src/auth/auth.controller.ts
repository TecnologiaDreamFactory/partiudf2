import {
  Body,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

export interface ValidatedUser {
  userId: string;
  role: string;
}

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ValidatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      return await this.authService.login(body.email, body.password);
    } catch (err) {
      console.error('[auth/login]', err);
      throw err;
    }
  }

  @Post('passenger-session')
  async passengerSession(@Body() body: { guestId: string }) {
    return this.authService.passengerSession(body?.guestId ?? '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@User() user: ValidatedUser) {
    const full = await this.authService.findById(user.userId);
    return full ?? { id: user.userId, email: '', role: user.role };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @User() user: ValidatedUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @User() user: ValidatedUser,
    @Body() body: { avatarUrl?: string; name?: string },
  ) {
    const updated = await this.authService.updateProfile(user.userId, {
      avatarUrl: body.avatarUrl,
      name: body.name,
    });
    return updated;
  }
}
