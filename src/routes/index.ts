import express from 'express';
import apikey from '../auth/apikey';
import permission from '../helpers/permission';
import { Permission } from '../database/ApiKey/model';
import login from './access/login';
import logout from './access/logout';
import token from './access/token';
import credential from './access/credential';
import profile from './profile';
import clinic from './clinic';
import dentist from './dentist';
import inquiry from './inquiry';
import general from './general';
import lab from './lab';
import patient from './patient';
import quote from './quote';
import order from './order';
import treatment from './treatment';
import transaction from './transaction';
import message from './message';
import notification from './notification';

const router = express.Router();

/*---------------------------------------------------------*/
router.use(apikey);
/*---------------------------------------------------------*/
/*---------------------------------------------------------*/
router.use(permission(Permission.GENERAL));
/*---------------------------------------------------------*/
router.use('/login', login);
router.use('/logout', logout);
router.use('/token', token);
router.use('/credential', credential);
router.use('/profile', profile);
router.use('/general', general);
router.use('/clinic', clinic);
router.use('/dentist', dentist);
router.use('/inquiry', inquiry);
router.use('/quote', quote);
router.use('/lab', lab);
router.use('/patient', patient);
router.use('/order', order);
router.use('/treatment', treatment);
router.use('/transaction', transaction);
router.use('/message', message);
router.use('/notification', notification);

export default router;
