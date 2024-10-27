import express from 'express';
import { TokenRefreshResponse } from '../../core/ApiResponse';
import { ProtectedRequest } from 'app-request';
import { Types } from 'mongoose';
import UserRepo from '../../database/User/repo';
import { AuthFailureError } from '../../core/ApiError';
import JWT from '../../core/JWT';
import KeystoreRepo from '../../database/KeyStore/repo';
import crypto from 'crypto';
import {
	validateTokenData,
	createTokens,
	getAccessToken,
} from '../../auth/authUtils';
import validator, { ValidationSource } from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import { getUserData } from './utils';
import User from '../../database/User/model';

const router = express.Router();

router.post(
	'/refresh',
	validator(schema.auth, ValidationSource.HEADER),
	validator(schema.refreshToken),
	asyncHandler(async (req: ProtectedRequest, res) => {
		req.accessToken = getAccessToken(req.headers.authorization); // Express headers are auto converted to lowercase

		const accessTokenPayload = await JWT.decode(req.accessToken);
		validateTokenData(accessTokenPayload);

		const user = await UserRepo.findById(
			new Types.ObjectId(accessTokenPayload.sub),
		);
		if (!user) throw new AuthFailureError('User is not registered');
		req.user = user;

		const refreshTokenPayload = await JWT.validate(req.body.refreshToken, true);
		validateTokenData(refreshTokenPayload);

		if (accessTokenPayload.sub !== refreshTokenPayload.sub)
			throw new AuthFailureError('Invalid access token');

		const keystore = await KeystoreRepo.find(
			req.user,
			accessTokenPayload.prm,
			refreshTokenPayload.prm,
		);

		if (!keystore) throw new AuthFailureError('Invalid access token');
		await KeystoreRepo.remove(keystore._id);

		const accessTokenKey = crypto.randomBytes(64).toString('hex');
		const refreshTokenKey = crypto.randomBytes(64).toString('hex');

		await KeystoreRepo.create(req.user, accessTokenKey, refreshTokenKey);
		const tokens = await createTokens(
			req.user,
			accessTokenKey,
			refreshTokenKey,
		);

		const foundUser = await UserRepo.findByEmail(user.email);
		if (!foundUser) throw new AuthFailureError('User not found');
		const userData = await getUserData(foundUser);

		new TokenRefreshResponse(
			'Token Issued',
			tokens.accessToken,
			tokens.refreshToken,
			userData as User,
		).send(res);
	}),
);

export default router;
