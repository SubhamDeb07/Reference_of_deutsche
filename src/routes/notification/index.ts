import express from 'express';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, { ValidationSource } from '../../helpers/validator';
import authentication from '../../auth/authentication';
import NotificationRepo from '../../database/Notification/repo';
import { Types } from 'mongoose';
import schema from './schema';

const router = express.Router();

//----------------------------------------------------------------

router.use('/', authentication);

router.get(
	'/',
	validator(schema.GetNotification, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { page = 1, limit = 10 } = req.query;

		const notifications = await NotificationRepo.getNotification(
			req.user._id,
			+page,
			+limit,
		);

		const unreadCount = await NotificationRepo.getNotificationUnreadCount(
			req.user._id,
		);

		new SuccessResponse('success', { notifications, unreadCount }).send(res);
	}),
);

router.get(
	'/messages',
	validator(schema.GetNotification, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { page = 1, limit = 10 } = req.query;

		const notifications = await NotificationRepo.getMessageNotification(
			req.user._id,
			+page,
			+limit,
		);

		const unreadCount = await NotificationRepo.getMessageUnreadCount(
			req.user._id,
		);

		new SuccessResponse('success', { notifications, unreadCount }).send(res);
	}),
);

router.put(
	'/:id/read',
	validator(schema.MarkAsRead, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		await NotificationRepo.markAsRead(
			new Types.ObjectId(req.params.id),
			req.user._id,
		);

		new SuccessResponse('success', {}).send(res);
	}),
);

export default router;
