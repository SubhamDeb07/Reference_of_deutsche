import { Queue, Worker } from 'bullmq';
import { io } from '../server';
import { redis } from '../config';
import { userSocketMap } from '../socket/index';
import Notification, { NotificationType } from '../database/Notification/model';
import NotificationRepo from '../database/Notification/repo';
import UserRepo from '../database/User/repo';
import _ from 'lodash';
import { sendMail } from '../helpers/mail';
import { extractObjectId } from '../helpers/validator';
import Logger from '../core/Logger';

function sendSocketMessage(
	noti: Pick<
		Notification,
		| 'type'
		| 'user'
		| 'description'
		| 'isRead'
		| 'associatedId'
		| 'associatedType'
	>,
) {
	const userId = noti.user.toString();

	if (userSocketMap[userId]) {
		userSocketMap[userId].forEach((socketId) => {
			io.to(socketId).emit('notification:receive', noti);
		});
	}
}

const connection = {
	host: redis.host,
	port: redis.port,
	password: redis.password,
};

const notificationQueue = new Queue<Notification>('notificationQueue', {
	connection,
});

const worker = new Worker(
	'notificationQueue',
	async (job) => {
		try {
			const createdNoti = await NotificationRepo.create(job.data);

			if (createdNoti.type === NotificationType.NEW_MESSAGE) {
				if (
					!createdNoti.messageDetails ||
					!createdNoti.messageDetails.patient ||
					!createdNoti.messageDetails.sender
				)
					return;
				const foundSender = await UserRepo.findFieldsById(
					extractObjectId(createdNoti.messageDetails.sender),
					'name',
					'profilePicUrl',
				);
				const foundPatient = await UserRepo.findFieldsById(
					extractObjectId(createdNoti.messageDetails.patient),
					'userId',
					'name',
					'profilePicUrl',
				);

				createdNoti.messageDetails.sender = foundSender;
				createdNoti.messageDetails.patient = foundPatient;
			}

			sendSocketMessage(
				_.pick(createdNoti, [
					'_id',
					'type',
					'user',
					'description',
					'isRead',
					'associatedId',
					'associatedType',
					'messageDetails',
				]),
			);

			if (createdNoti.type === NotificationType.NEW_MESSAGE) return;

			const foundUser = await UserRepo.findFieldsById(
				extractObjectId(createdNoti.user),
				'email',
				'name',
			);

			if (!foundUser) return;

			let inputString = createdNoti.email || '';

			inputString = inputString.replace(/\n/g, '<br/>');

			let subject = inputString.split('<br/>')[0];
			const body = inputString.replace(subject, '');
			subject = subject.replace('Subject: ', '');

			await sendMail(foundUser.email, subject, body);
		} catch (err) {
			Logger.error(err);
		}
	},
	{
		connection,
	},
);

worker.on('completed', (job) => {
	console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
	console.log(`${job?.id} has failed with ${err.message}`);
});

export default notificationQueue;
