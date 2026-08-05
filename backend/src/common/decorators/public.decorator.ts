import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants';

/**
 * Opts a route out of the global JWT guard. Use sparingly — auth is on by
 * default for every endpoint.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
