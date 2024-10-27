import Notification, { NotificationModel, NotificationType } from './model';
import { Types } from 'mongoose';

async function create(notification: Notification): Promise<Notification> {
	const now = new Date();
	notification.createdAt = now;
	notification.updatedAt = now;
	notification.isRead = false;

	const createdOrder = await NotificationModel.create(notification);

	return createdOrder.toObject();
}

async function markAsRead(
	notificationId: Types.ObjectId,
	userId: Types.ObjectId,
) {
	return NotificationModel.updateOne(
		{ _id: notificationId, user: userId },
		{ isRead: true },
	).exec();
}

async function getNotification(
	userId: Types.ObjectId,
	page: number,
	limit: number,
): Promise<Notification | null> {
	return await NotificationModel.find({
		user: userId,
		type: { $ne: NotificationType.NEW_MESSAGE },
	})
		.skip(limit * (page - 1))
		.limit(limit)
		.sort({ createdAt: -1 })
		.lean<Notification>()
		.exec();
}

async function getNotificationUnreadCount(userId: Types.ObjectId) {
	return await NotificationModel.countDocuments({
		user: userId,
		isRead: false,
		type: { $ne: NotificationType.NEW_MESSAGE },
	}).exec();
}

async function getMessageNotification(
	userId: Types.ObjectId,
	page: number,
	limit: number,
): Promise<Notification | null> {
	return await NotificationModel.find({
		user: userId,
		type: NotificationType.NEW_MESSAGE,
	})
		.populate({
			path: 'messageDetails.patient messageDetails.sender',
			select: 'name userId profilePicUrl',
		})
		.skip(limit * (page - 1))
		.limit(limit)
		.sort({ createdAt: -1 })
		.lean<Notification>()
		.exec();
}

async function getMessageUnreadCount(userId: Types.ObjectId) {
	return await NotificationModel.countDocuments({
		user: userId,
		isRead: false,
		type: NotificationType.NEW_MESSAGE,
	}).exec();
}

export default {
	create,
	markAsRead,
	getNotification,
	getNotificationUnreadCount,
	getMessageNotification,
	getMessageUnreadCount,
};
