import { getUsersHandler, getUsersResponseSchema, createUserHandler, createUserBodySchema, createUserResponseSchema } from '../handlers/user';
import { createRouter } from '../utils/route';

const router = createRouter();

router.get('/', { response: getUsersResponseSchema, summary: 'Get all users' }, getUsersHandler);
router.post('/', { body: createUserBodySchema, response: createUserResponseSchema, summary: 'Create a new user' }, createUserHandler);

export default router;
