import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';

import { CurrentUser, Public } from '@/common/decorators';
import { type AppConfig } from '@/config';

import { AuthService, type SessionResult } from './auth.service';
import {
  AuthUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  MessageResponseDto,
  RefreshResponseDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

/** Where the refresh cookie is scoped — it is never sent to non-auth routes. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // -------------------------------------------------------------------------

  @Public()
  // Deliberately tighter than the global limit: this is the endpoint worth
  // guessing against.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns a short-lived access token in the body and sets an httpOnly refresh cookie. ' +
      'Hold the access token in memory only — never in localStorage.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.auth.login(dto, this.contextOf(request));
    return this.respondWithSession(session, response);
  }

  // -------------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Exchange the refresh cookie for a new access token',
    description:
      'Rotates the refresh token. Replaying a spent token revokes the whole session family.',
  })
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const token = this.readRefreshCookie(request);

    if (!token) {
      throw new UnauthorizedException('No refresh token supplied');
    }

    try {
      const session = await this.auth.refresh(token, this.contextOf(request));
      const { accessToken, expiresIn } = this.respondWithSession(session, response);
      return { accessToken, expiresIn };
    } catch (error) {
      // The cookie is unusable either way; clearing it stops the client from
      // retrying in a loop.
      this.clearRefreshCookie(response);
      throw error;
    }
  }

  // -------------------------------------------------------------------------

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'End the current session' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    await this.auth.logout(this.readRefreshCookie(request), userId);
    this.clearRefreshCookie(response);
    return { message: 'Signed out' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'End every session for this account, on all devices' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    await this.auth.logoutAll(userId);
    this.clearRefreshCookie(response);
    return { message: 'Signed out of all devices' };
  }

  // -------------------------------------------------------------------------

  @Public()
  // Password reset mails cost money and annoy users; keep the ceiling low.
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Always succeeds, whether or not the address is registered, so it cannot be used to ' +
      'discover which accounts exist.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<MessageResponseDto> {
    await this.auth.forgotPassword(dto, this.contextOf(request));
    return { message: 'If that address is registered, a reset link is on its way.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ type: MessageResponseDto })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    await this.auth.resetPassword(dto);
    this.clearRefreshCookie(response);
    return { message: 'Password updated. Please sign in again.' };
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change your own password',
    description: 'Requires the current password. All sessions are ended, including this one.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    await this.auth.changePassword(userId, dto);
    this.clearRefreshCookie(response);
    return { message: 'Password updated. Please sign in again.' };
  }

  // -------------------------------------------------------------------------

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Profile, roles, and permissions of the signed-in user' })
  @ApiOkResponse({ type: AuthUserDto })
  async me(@CurrentUser('id') userId: string): Promise<AuthUserDto> {
    return this.auth.getProfile(userId);
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Edit your own profile and preferences',
    description:
      'Needs no permission — this is the signed-in user acting on their own account. Email, ' +
      'status, and roles are not editable here; those are administrative and live under /users.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: AuthUserDto })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserDto> {
    return this.auth.updateProfile(userId, dto);
  }

  // -------------------------------------------------------------------------
  // Cookie plumbing
  // -------------------------------------------------------------------------

  private respondWithSession(session: SessionResult, response: Response): LoginResponseDto {
    this.setRefreshCookie(response, session.refreshToken.token, session.refreshToken.expiresAt);
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }

  private readRefreshCookie(request: Request): string | undefined {
    const { refreshCookieName } = this.config.get('auth', { infer: true });
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[refreshCookieName];
  }

  /**
   * httpOnly so script cannot read it, sameSite=strict so it is never attached
   * to a cross-site request (which is what makes a CSRF token unnecessary
   * here), and path-scoped so it is not broadcast to every API call.
   */
  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    const { refreshCookieName, cookieSecure, cookieDomain } = this.config.get('auth', {
      infer: true,
    });

    response.cookie(refreshCookieName, token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
  }

  private clearRefreshCookie(response: Response): void {
    const { refreshCookieName, cookieSecure, cookieDomain } = this.config.get('auth', {
      infer: true,
    });

    // Attributes must match the ones used to set it, or the browser keeps it.
    response.clearCookie(refreshCookieName, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
  }

  private contextOf(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
