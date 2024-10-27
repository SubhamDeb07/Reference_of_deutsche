import { Schema, model, Types } from 'mongoose';
import User from '../User/model';

export const DOCUMENT_NAME = 'ChatRoom';
export const COLLECTION_NAME = 'chatrooms';

export default interface ChatRoom {
	_id: Types.ObjectId;
	users: User[] | Types.ObjectId[];
	roomId: string;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<ChatRoom>(
	{
		roomId: String,
		users: [
			{
				type: Types.ObjectId,
				ref: 'User',
			},
		],
	},
	{
		timestamps: true,
	},
);

export const ChatRoomModel = model<ChatRoom>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
