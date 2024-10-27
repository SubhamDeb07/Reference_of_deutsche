import _ from 'lodash';
import ChatRoomRepo from '../database/ChatRoom/repo';
import MessageRepo from '../database/Message/repo';
import Message from '../database/Message/model';
import { CustomSocket } from '../types/app-request';
import { Types } from 'mongoose';
import { messageEvent } from '../events';
import Logger from '../core/Logger';

const roomUserMap: {
	[roomName: string]: Set<Types.ObjectId>;
} = {};

const registerChatEvents = (socket: CustomSocket) => {
	socket.on('room:join', async (room: string) => {
		try {
			const foundRoom = await ChatRoomRepo.findByRoomId(room);

			if (!foundRoom) {
				socket.emit('error', { message: 'Room not found' });
				return;
			}

			if (
				foundRoom.users.findIndex((usr) => usr._id.equals(socket.user._id)) ===
				-1
			) {
				socket.emit('error', { message: 'User not in room' });
				return;
			}

			socket.join(room);

			if (!roomUserMap[room]) {
				roomUserMap[room] = new Set();
			}

			roomUserMap[room].add(socket.user._id);

			const recentMessages =
				await MessageRepo.getMessagesByRoomIdWithPagination(room, 1, 50);

			socket.emit('room:welcome', {
				message: `Welcome to the room: ${room}`,
				data: {
					roomDetails: _.pick(foundRoom, ['roomId', 'users']),
					recentMessages: recentMessages.reverse(),
					activeUsers: Array.from(roomUserMap[room]),
				},
			});

			socket.to(room).emit('room:active:users', Array.from(roomUserMap[room]));
		} catch (error) {
			Logger.error(error);
		}
	});

	socket.on(
		'message:send',
		async (room: string, message = '', content: string[] = []) => {
			try {
				await MessageRepo.create({
					roomId: room,
					user: socket.user._id,
					message,
					content,
				} as Message);

				socket.to(room).emit('message:onnew', {
					user: socket.user._id,
					content,
					message,
					createdAt: new Date(),
				});

				const foundRoom = await ChatRoomRepo.findFieldsByRoomId(room, 'users');

				if (foundRoom && message.length) {
					const roomUsers = foundRoom.users.map((user) => user._id.toString());
					const activeUsers = Array.from(roomUserMap[room]).map((user) =>
						user.toString(),
					);

					const offlineUsers = roomUsers
						.filter((user) => !activeUsers.includes(user))
						.map((user) => new Types.ObjectId(user));

					const patientId = new Types.ObjectId(room.replace('lab', ''));

					messageEvent.onNewMessage(
						room,
						message,
						offlineUsers,
						socket.user._id,
						patientId,
					);
				}
			} catch (error) {
				Logger.error(error);
			}
		},
	);

	socket.on('disconnect', () => {
		let roomName = null;
		for (const room in roomUserMap) {
			if (roomUserMap[room].has(socket.user._id)) {
				roomName = room;
				roomUserMap[room].delete(socket.user._id);
			}
		}

		if (roomName) {
			socket
				.to(roomName)
				.emit('room:active:users', Array.from(roomUserMap[roomName]));
		}

		console.log(`${socket.user.name} has disconnected`);
	});
};

export default registerChatEvents;
