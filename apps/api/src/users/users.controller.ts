import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User, type ValidatedUser } from '../auth/auth.controller';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Patch('me')
  async updateMe(
    @User() user: ValidatedUser,
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    const updated = await this.authService.updateProfile(user.userId, {
      name: body.name,
      avatarUrl: body.avatarUrl,
    });
    return updated;
  }
}
