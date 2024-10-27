import express from 'express';

const router = express.Router();

import file from './file';
import country from './country';
import city from './city';

router.use('/file', file);
router.use('/countries', country);
router.use('/cities', city);

export default router;
