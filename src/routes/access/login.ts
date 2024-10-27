import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import crypto from 'crypto';
import UserRepo from '../../database/User/repo';
import {
	BadRequestError,
	AuthFailureError,
	ForbiddenError,
} from '../../core/ApiError';
import KeystoreRepo from '../../database/KeyStore/repo';
import { createTokens } from '../../auth/authUtils';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import bcrypt from 'bcrypt';
import { getUserData } from './utils';
import { PublicRequest } from '../../types/app-request';
import { ApprovalStatus } from '../../database/User/model';

const router = express.Router();

router.post(
	'/basic',
	validator(schema.credential),
	asyncHandler(async (req: PublicRequest, res) => {
		req.body.email = req.body.email.toLowerCase();

		const user = await UserRepo.findByEmail(req.body.email);
		if (!user) throw new BadRequestError('User is not registered');
		if (!user.password) throw new BadRequestError('Credentials not set');
		if (!user.isActive) throw new ForbiddenError('User is inactive');
		// if (!user.isPermissionAdded)
		// 	throw new ForbiddenError(
		// 		'You lack the necessary permissions to proceed.',
		// 	);
		if (user.approvalStatus == ApprovalStatus.PENDING)
			throw new ForbiddenError('Awaiting approval.');
		if (user.approvalStatus == ApprovalStatus.REJECTED)
			throw new ForbiddenError('Approval has been rejected.');

		let match = false;
		if (req.body.password === user.password) match = true;
		if (await bcrypt.compare(req.body.password, user.password)) match = true;
		if (match === false)
			throw new AuthFailureError('Invalid username or password');

		const accessTokenKey = crypto.randomBytes(64).toString('hex');
		const refreshTokenKey = crypto.randomBytes(64).toString('hex');

		await KeystoreRepo.create(user, accessTokenKey, refreshTokenKey);
		const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);
		const userData = await getUserData(user);

		new SuccessResponse('Login Success', {
			user: userData,
			tokens: tokens,
		}).send(res);
	}),
);

export default router;
