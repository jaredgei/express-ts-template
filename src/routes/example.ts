import { exampleHandler, exampleQuerySchema, exampleResponseSchema } from '../handlers/example';
import { createRouter } from '../utils/route';

const router = createRouter(); // /api/example

router.get('/', { query: exampleQuerySchema, response: exampleResponseSchema }, exampleHandler);

export default router;
