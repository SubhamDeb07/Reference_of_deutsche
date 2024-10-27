import ChatRoom, { ChatRoomModel } from './model';
import { Types } from 'mongoose';

async function findById(id: Types.ObjectId): Promise<ChatRoom | null> {
	return ChatRoomModel.findOne({ _id: id }).lean().exec();
}

async function findByRoomId(roomId: string): Promise<ChatRoom | null> {
	return ChatRoomModel.findOne({ roomId })
		.populate({ path: 'users', select: '_id userId profilePicUrl name email' })
		.lean()
		.exec();
}

async function findFieldsByRoomId(
	roomId: Types.ObjectId | string,
	...fields: string[]
): Promise<ChatRoom | null> {
	return ChatRoomModel.findOne({ roomId }, [...fields])
		.lean()
		.exec();
}

async function addUsersToRoom(roomId: string, users: Types.ObjectId[]) {
	return ChatRoomModel.updateOne(
		{ roomId },
		{
			$addToSet: { users },
			$set: { updatedAt: new Date() },
		},
		{
			new: true,
		},
	)
		.lean()
		.exec();
}

async function create(chatRoom: ChatRoom): Promise<ChatRoom> {
	const now = new Date();
	chatRoom.createdAt = now;
	chatRoom.updatedAt = now;
	const created = await ChatRoomModel.create(chatRoom);
	return created.toObject();
}

async function update(chatRoom: ChatRoom): Promise<ChatRoom | null> {
	chatRoom.updatedAt = new Date();
	return ChatRoomModel.findByIdAndUpdate(chatRoom._id, chatRoom, { new: true })
		.lean()
		.exec();
}

export default {
	addUsersToRoom,
	findById,
	findByRoomId,
	findFieldsByRoomId,
	create,
	update,
};
