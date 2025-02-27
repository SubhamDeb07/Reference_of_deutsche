import express from 'express';
import { ProtectedRequest } from 'app-request';
import { AuthFailureError } from '../core/ApiError';
import RoleRepo from '../database/Role/repo';
import asyncHandler from '../helpers/asyncHandler';

const router = express.Router();

export default router.use(
	asyncHandler(async (req: ProtectedRequest, res, next) => {
		if (!req.user || !req.user.role || !req.currentRoleCodes)
			throw new AuthFailureError('Permission denied');

		const roles = await RoleRepo.findByCodes(req.currentRoleCodes);
		if (roles.length === 0) throw new AuthFailureError('Permission denied');

		let authorized = false;

		for (const role of roles) {
			if (authorized) break;
			if (req.user.role._id.equals(role._id)) {
				authorized = true;
				break;
			}
		}

		if (!authorized) throw new AuthFailureError('Permission denied');

		return next();
	}),
);
