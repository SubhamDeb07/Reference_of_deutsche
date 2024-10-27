import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { RoleRequest } from 'app-request';
import UserRepo from '../../database/User/repo';
import { BadRequestError } from '../../core/ApiError';
import User from '../../database/User/model';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import bcrypt from 'bcrypt';
import { RoleCode } from '../../database/Role/model';
import { getUserData } from './utils';

const router = express.Router();

router.post(
	'/basic',
	validator(schema.signup),
	asyncHandler(async (req: RoleRequest, res) => {
		const user = await UserRepo.findByEmail(req.body.email);
		if (user) throw new BadRequestError('User is already registered');

		const passwordHash = req.body.password;

		// const { user: createdUser } = await UserRepo.create(
		// 	{
		// 		name: req.body.name,
		// 		email: req.body.email,
		// 		profilePicUrl: req.body.profilePicUrl,
		// 		password: passwordHash,
		// 	} as User,
		// 	RoleCode.DENTIST,
		// );

		// const userData = await getUserData(createdUser);

		new SuccessResponse('Signup Successful', {
			user: {},
		}).send(res);
	}),
);

export default router;
