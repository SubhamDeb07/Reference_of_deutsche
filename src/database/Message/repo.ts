import Message, { MessageModel } from './model';
import { Types } from 'mongoose';

async function findById(id: Types.ObjectId): Promise<Message | null> {
	return MessageModel.findOne({ _id: id }).lean().exec();
}

async function create(message: Message): Promise<Message> {
	const now = new Date();
	message.createdAt = now;
	message.updatedAt = now;
	const created = await MessageModel.create(message);
	return created.toObject();
}

async function update(message: Message): Promise<Message | null> {
	message.updatedAt = new Date();
	return MessageModel.findByIdAndUpdate(message._id, message, { new: true })
		.lean()
		.exec();
}

async function getMessagesByRoomIdWithPagination(
	roomId: string,
	pageNumber: number,
	limit: number,
): Promise<Message[]> {
	return MessageModel.find({ roomId })
		.sort({ createdAt: -1 })
		.skip(limit * (pageNumber - 1))
		.limit(limit)
		.lean()
		.exec();
}

export default {
	findById,
	getMessagesByRoomIdWithPagination,
	create,
	update,
};
