import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { type AuthenticatedUser, type RequestWithUser } from '../types';

/**
 * Injects the authenticated user, or one of its fields:
 *   `@CurrentUser() user: AuthenticatedUser`
 *   `@CurrentUser('id') userId: string`
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
