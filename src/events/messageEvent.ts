import EventEmitter from 'events';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { notificationQueue } from '../queues';
import { Types } from 'mongoose';
import Logger from '../core/Logger';

const eventEmitter = new EventEmitter();

function onNewMessage(
	roomId: string,
	message: string,
	offlineUsers: Types.ObjectId[],
	senderId: Types.ObjectId,
	patientId: Types.ObjectId,
) {
	eventEmitter.emit(
		'newMessage',
		roomId,
		message,
		offlineUsers,
		senderId,
		patientId,
	);
}

eventEmitter.on(
	'newMessage',
	async (
		roomId: string,
		message: string,
		offlineUsers: Types.ObjectId[],
		senderId: Types.ObjectId,
		patientId: Types.ObjectId,
	) => {
		try {
			offlineUsers.forEach((offlineUser) => {
				const notificationData: Notification = {
					_id: new Types.ObjectId(),
					type: NotificationType.NEW_MESSAGE,
					description: message,
					user: offlineUser,
					associatedId: roomId,
					associatedType: AssociatedType.CHAT_ROOM,
					messageDetails: {
						sender: senderId,
						patient: patientId,
					},
					isRead: false,
				};

				notificationQueue.add('sendNotification', notificationData);
			});
		} catch (err) {
			Logger.error(err);
		}
	},
);

export default {
	onNewMessage,
};
