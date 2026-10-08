import userRouter from '@/routes/user';

import { MountedRouter } from '@/utils/route';

export const mountedRouters: MountedRouter[] = [{ prefix: '/api/users', router: userRouter }];
