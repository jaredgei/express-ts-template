import { Router } from 'express';
import { exampleHandler, exampleValidator } from '../handlers/example';

// /api/track
const router = Router();

// GET
router.get('/', exampleValidator, exampleHandler); // /api/track

export default router;
