import express from 'express';
import { ProtectedRequest } from 'app-request';
import { Types } from 'mongoose';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import { BadRequestError, InternalError } from '../../core/ApiError';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import Role, { RoleCode } from '../../database/Role/model';
import LabRepo from '../../database/Lab/repo';
import UserRepo from '../../database/User/repo';
import KeyStoreRepo from '../../database/KeyStore/repo';
import User, { ApprovalStatus } from '../../database/User/model';
import bcrypt from 'bcrypt';
import { setPasswordMail } from '../../helpers/mail';
import moment from 'moment';
import _ from 'lodash';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.get(
	'/',
	validator(schema.getPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { pageNumber = 1, limit = 10 } = req.query;

		const foundLabs = await LabRepo.getAllPaginated(+pageNumber, +limit);

		new SuccessResponse('Success', foundLabs).send(res);
	}),
);

router.put(
	'/update',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.updateLab, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const labId = extractObjectId(req.user.lab);
		const foundLab = await LabRepo.findById(labId);

		if (!foundLab) throw new BadRequestError('Lab not found');

		await LabRepo.update({
			_id: labId,
			...req.body,
		});

		if (foundLab.isImpressionRequired !== req.body.isImpressionRequired) {
			const foundLabUserIds = await UserRepo.getAllUserIdsByLab(labId);

			await KeyStoreRepo.removeAllForAllClient(
				foundLabUserIds
					.map((usr) => usr._id)
					.filter((id) => !id.equals(req.user._id)),
			);
		}

		return new SuccessResponse('Lab updated', req.body).send(res);
	}),
);

router.get(
	'/users',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getUsers, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { pageNumber = 1, limit = 10, searchQuery = '', role } = req.query;
		const labId = extractObjectId(req.user.lab);

		const data = await UserRepo.getLabUsersWithSearch(
			labId,
			searchQuery as string,
			role as string,
			+pageNumber,
			+limit,
		);

		const users = data[0].map((user) => {
			const obj = {
				...user,
				isSetPassword: user.password ? true : false,
			};

			delete obj.password;
			return obj;
		});

		return new SuccessResponse('Success', {
			users: users,
			count: data[1],
		}).send(res);
	}),
);

router.post(
	'/createUser',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.createLabUser, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		req.body.approvalStatus = ApprovalStatus.APPROVED;
		req.body.isPermissionAdded = true;

		const role = req.body.role;

		let randomPassword = Math.random().toString(36).slice(-8);
		const realPassword = randomPassword;

		randomPassword = randomPassword;

		if (req.body.email) {
			const user = await UserRepo.findByEmail(req.body.email);
			if (user) throw new BadRequestError('This email is already in use');
		}

		const createdUser = await UserRepo.create(
			req.body,
			role,
			extractObjectId(req.user.lab),
		);

		if (!createdUser) throw new InternalError(`Unable to create ${role}`);

		// const verificationToken = bcrypt.hashSync(
		// 	createdUser.user._id.toString() + Date.now().toString(),
		// 	10,
		// );

		const lab = await LabRepo.findFieldsById(extractObjectId(req.user.lab));

		if (!lab) throw new BadRequestError('Lab do not exists');

		const expiresAt = moment().add(90, 'days').toDate();

		await UserRepo.updateInfo({
			_id: createdUser.user._id,
			approvalStatus: req.body.status,
			password: randomPassword,
			// verificationToken: {
			// 	token: verificationToken,
			// 	expiresAt,
			// },
		} as User);

		const passwordResetParams = {
			recipientEmail: createdUser.user.email,
			token: realPassword,
		};

		await setPasswordMail(
			passwordResetParams,
			req.body.name,
			'',
			lab.name,
			'invitation',
			role,
		);

		return new SuccessResponse('Success', {
			user: _.pick(createdUser.user, ['_id', 'name', 'role', 'email']),
		}).send(res);
	}),
);

export default router;
