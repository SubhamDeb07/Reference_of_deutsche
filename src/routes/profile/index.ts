import express from 'express';
import moment from 'moment';
import bcrypt from 'bcrypt';
import { SuccessResponse } from '../../core/ApiResponse';
import UserRepo from '../../database/User/repo';
import { ProtectedRequest } from 'app-request';
import { BadRequestError, AuthFailureError } from '../../core/ApiError';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import _ from 'lodash';
import authentication from '../../auth/authentication';
import { Types } from 'mongoose';
import User from '../../database/User/model';
import { setPasswordMail } from '../../helpers/mail';
import { RoleCode } from '../../database/Role/model';
import RoleRepo from '../../database/Role/repo';
import ClinicRepo from '../../database/Clinic/repo';
import LabRepo from '../../database/Lab/repo';
import authorization from '../../auth/authorization';
import role from '../../helpers/role';
import { userEvent } from '../../events';

const router = express.Router();

/*-------------------------------------------------------------------------*/
router.use(authentication);
/*-------------------------------------------------------------------------*/

router.get(
	'/my',
	asyncHandler(async (req: ProtectedRequest, res) => {
		const user = await UserRepo.findPrivateProfileById(req.user._id);
		if (!user) throw new BadRequestError('User is not registered');

		return new SuccessResponse(
			'success',
			_.pick(user, [
				'name',
				'email',
				'profilePicUrl',
				'role',
				'phoneNumber',
				'countryCode',
				'address',
			]),
		).send(res);
	}),
);

router.put(
	'/privilege',
	role(RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.setPrivilege, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { readPricing, createOrder, createDentist, updateClinic, user } =
			req.body;

		const foundUser = await UserRepo.findFieldsById(
			user,
			'isPermissionAdded',
			'privilege',
			'email',
		);

		if (!foundUser) throw new BadRequestError('User is not registered');

		if (_.isBoolean(readPricing)) foundUser.privilege.readPricing = readPricing;
		if (_.isBoolean(createOrder)) foundUser.privilege.createOrder = createOrder;
		if (_.isBoolean(createDentist))
			foundUser.privilege.createDentist = createDentist;
		if (_.isBoolean(updateClinic))
			foundUser.privilege.updateClinic = updateClinic;

		await UserRepo.updateInfo({
			...foundUser,
			isPermissionAdded: true,
		} as User);

		userEvent.onUpdatePrivilege(foundUser._id);

		return new SuccessResponse('success', foundUser).send(res);
	}),
);
router.post('/', asyncHandler(async (req,res)=>{
    
}))

router.post(
	'/approve',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.approveDentist, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const userId = req.body.dentistId;
		const foundUser = await UserRepo.findFieldsById(
			userId,
			'_id',
			'email',
			'name',
			'role',
			'clinic',
			'lab',
		);

		if (!foundUser) throw new BadRequestError('User is not registered');

		const verificationToken = bcrypt.hashSync(
			userId + Date.now().toString(),
			10,
		);
		const expiresAt = moment().add(90, 'days').toDate();

		await UserRepo.updateInfo({
			_id: userId,
			approvalStatus: req.body.status,
			verificationToken: {
				token: verificationToken,
				expiresAt,
			},
		} as User);

		const role = await RoleRepo.findFieldsById(extractObjectId(foundUser.role));
		if (!role) throw new BadRequestError('Role do not exists');
		if (!foundUser.clinic) throw new BadRequestError('Clinic do not exists');
		const clinic = await ClinicRepo.findFieldsById(
			extractObjectId(foundUser.clinic),
		);
		if (!clinic) throw new BadRequestError('Clinic do not exists');

		const lab = await LabRepo.findFieldsById(extractObjectId(foundUser.lab));
		if (!lab) throw new BadRequestError('Lab do not exists');

		const passwordResetParams = {
			recipientEmail: foundUser.email,
			token: verificationToken,
		};

		await setPasswordMail(
			passwordResetParams,
			foundUser.name,
			clinic.name,
			lab.name,
			'invitation',
			role.code,
		);

		new SuccessResponse(`Dentist ${req.body.status.toLowerCase()}`, {
			approvalStatus: req.body.status,
		}).send(res);
	}),
);

router.get(
	'/:id',
	validator(schema.userId, ValidationSource.PARAM),
	asyncHandler(async (req, res) => {
		const foundUser = await UserRepo.findPublicProfileById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundUser) throw new BadRequestError('User is not registered');

		const obj = {
			...foundUser,
			isSetPassword: foundUser.password ? true : false,
		};

		return new SuccessResponse('success', obj).send(res);
	}),
);

router.put(
	'/',
	validator(schema.profile),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const user = await UserRepo.findPrivateProfileById(req.user._id);
		if (!user) throw new BadRequestError('User not registered');

		await UserRepo.updateInfo({
			_id: req.user._id,
			...req.body,
		} as User);

		return new SuccessResponse('Pprofile updated', req.body).send(res);
	}),
);

router.put(
	'/updateUser/:id',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.updateLabUser, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundUser = await UserRepo.findById(
			new Types.ObjectId(req.params.id),
		);
		const labId = extractObjectId(req.user.lab);

		if (!foundUser) throw new BadRequestError('User is not registered');
		if (labId.equals(foundUser.lab._id)) {
			await UserRepo.updateInfo({
				_id: req.params.id,
				...req.body,
			} as User);
		} else {
			throw new AuthFailureError('You are not authorized to update this user');
		}

		new SuccessResponse('Success', req.body).send(res);
	}),
);

router.post(
	'/resendInvitation',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.userId, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { id } = req.body;

		const foundUser = await UserRepo.findFieldsById(
			id,
			'name',
			'email',
			'role',
			'clinic',
			'lab',
		);

		if (!foundUser) throw new BadRequestError('User do not exists');

		const verificationToken = bcrypt.hashSync(
			foundUser._id.toString() + Date.now().toString(),
			10,
		);

		const expiresAt = moment().add(90, 'days').toDate();

		await UserRepo.updateInfo({
			_id: foundUser._id,
			approvalStatus: req.body.status,
			verificationToken: {
				token: verificationToken,
				expiresAt,
			},
		} as User);

		const foundRole = await RoleRepo.findFieldsById(
			extractObjectId(foundUser.role),
			'code',
		);

		if (!foundRole) throw new BadRequestError('User type not exist');

		let foundClinic;
		if (foundUser.clinic) {
			foundClinic = await ClinicRepo.findFieldsById(
				extractObjectId(foundUser.clinic),
				'name',
			);
		}

		const lab = await LabRepo.findFieldsById(
			extractObjectId(foundUser.lab),
			'name',
		);

		if (!lab) throw new BadRequestError('Unable to find lab');

		const passwordResetParams = {
			recipientEmail: foundUser.email,
			token: verificationToken,
		};

		await setPasswordMail(
			passwordResetParams,
			foundUser.name,
			foundClinic?.name || '',
			lab.name,
			'invitation',
			foundRole.code,
		);

		return new SuccessResponse('Success', {
			user: _.pick(foundUser, ['_id', 'email']),
		}).send(res);
	}),
);
export default router;
