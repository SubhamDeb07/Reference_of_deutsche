import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { ProtectedRequest, PublicRequest, RoleRequest } from 'app-request';
import UserRepo from '../../database/User/repo';
import {
	AuthFailureError,
	BadRequestError,
	ForbiddenError,
} from '../../core/ApiError';
import User from '../../database/User/model';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import _ from 'lodash';
import { RoleCode } from '../../database/Role/model';
import RoleRepo from '../../database/Role/repo';
import role from '../../helpers/role';
import authorization from '../../auth/authorization';
import authentication from '../../auth/authentication';
import KeystoreRepo from '../../database/KeyStore/repo';
import moment from 'moment';
import { setPasswordMail } from '../../helpers/mail';
import { createTokens } from '../../auth/authUtils';
import { getUserData } from './utils';

const router = express.Router();

router.put(
	'/setpassword',
	validator(schema.setPassword, ValidationSource.BODY),
	asyncHandler(async (req: PublicRequest, res) => {
		const user = await UserRepo.findByVerificationToken(req.body.token);

		if (!user) throw new BadRequestError('Password already set. Thank you!');

		// if (moment(user.verificationToken?.expiresAt).isBefore(moment())) {
		// 	throw new BadRequestError('Link has expired. Please try again.');
		// }

		const passwordHash = req.body.password;

		await UserRepo.updateInfo({
			_id: user._id,
			password: passwordHash,
			verificationToken: {
				token: null,
				expiresAt: null,
			},
		} as User);

		new SuccessResponse('Password updated', {}).send(res);
	}),
);

router.put(
	'/updatepassword',
	authentication,
	validator(schema.updatePassword, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { oldPassword, newPassword } = req.body;

		const foundUser = await UserRepo.findById(req.user._id);

		if (!foundUser) throw new BadRequestError('User is not registered');
		if (!foundUser.password) throw new BadRequestError('Credentials not set');
		if (!foundUser.isActive) throw new ForbiddenError('User is inactive');

		let match = false;
		if (oldPassword === foundUser.password) match = true;
		if (await bcrypt.compare(oldPassword, foundUser.password)) match = true;

		if (match === false)
			throw new AuthFailureError('Invalid username or password');

		await KeystoreRepo.removeAllForClient(foundUser);

		await UserRepo.updateInfo({
			_id: foundUser._id,
			password: newPassword,
		} as User);

		const accessTokenKey = crypto.randomBytes(64).toString('hex');
		const refreshTokenKey = crypto.randomBytes(64).toString('hex');

		await KeystoreRepo.create(foundUser, accessTokenKey, refreshTokenKey);
		const tokens = await createTokens(
			foundUser,
			accessTokenKey,
			refreshTokenKey,
		);
		const userData = await getUserData(foundUser);

		new SuccessResponse('Password updated', {
			user: userData,
			tokens: tokens,
		}).send(res);
	}),
);

router.get(
	'/tokenvalidity',
	validator(schema.tokenValidity, ValidationSource.QUERY),
	asyncHandler(async (req: PublicRequest, res) => {
		const user = await UserRepo.findByVerificationToken(
			req.query.token as string,
		);

		if (!user) throw new BadRequestError('User is not registered');

		// if (moment(user.verificationToken?.expiresAt).isBefore(moment())) {
		// 	throw new TokenExpiredError('Link has expired. Please try again.');
		// }

		new SuccessResponse('Token is valid', {}).send(res);
	}),
);

router.post(
	'/user/assign',
	authentication,
	role(RoleCode.ADMIN),
	authorization,
	validator(schema.credential),
	asyncHandler(async (req: RoleRequest, res) => {
		const user = await UserRepo.findByEmail(req.body.email);
		if (!user) throw new BadRequestError('User is not registered');

		const passwordHash = req.body.password;

		await UserRepo.updateInfo({
			_id: user._id,
			password: passwordHash,
		} as User);

		await KeystoreRepo.removeAllForClient(user);

		new SuccessResponse(
			'User password updated',
			_.pick(user, ['_id', 'name', 'email']),
		).send(res);
	}),
);

router.post(
	'/forgetpassword',
	validator(schema.forgetPassword, ValidationSource.BODY),
	asyncHandler(async (req: PublicRequest, res) => {
		const { email } = req.body;

		const user = await UserRepo.findByEmail(email);
		if (!user) throw new BadRequestError('User is not registered');
		const role = await RoleRepo.findFieldsById(extractObjectId(user.role));
		if (!role) throw new BadRequestError('Role do not exists');
		const name = user.name || 'User';
		const verificationToken = bcrypt.hashSync(
			user._id.toString() + Date.now().toString(),
			10,
		);

		await UserRepo.updateInfo({
			_id: user._id,
			verificationToken: {
				token: verificationToken,
				expiresAt: moment().add(60, 'minutes').toDate(),
			},
		} as User);

		const passwordResetParams = {
			recipientEmail: req.body.email,
			token: verificationToken,
		};

		await setPasswordMail(
			passwordResetParams,
			name,
			'',
			'',
			'forget',
			role.code,
		);

		new SuccessResponse(
			'Verification token sent. It will be effective for 15 minutes',
			{},
		).send(res);
	}),
);

export default router;
