import { Router } from 'express';
import { exampleHandler, exampleValidator } from '../handlers/example';

// /api/example
const router = Router();

// GET
router.get('/', exampleValidator, exampleHandler); // /api/example

export default router;
