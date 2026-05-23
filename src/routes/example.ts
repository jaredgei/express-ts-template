import { Router } from 'express';
import { exampleHandler, exampleValidator } from '../handlers/example';
import validate from '../middleware/validator';

// /api/example
const router = Router();

// GET
router.get('/', validate(exampleValidator), exampleHandler); // /api/example

export default router;
