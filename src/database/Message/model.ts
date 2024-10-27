import { Schema, model, Types } from 'mongoose';
import User from '../User/model';

export const DOCUMENT_NAME = 'Message';
export const COLLECTION_NAME = 'messages';

export default interface Message {
	_id: Types.ObjectId;
	roomId: string;
	user: User | Types.ObjectId;
	message: string;
	content: string[];
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Message>(
	{
		roomId: { type: String, required: true },
		user: {
			type: Types.ObjectId,
			ref: 'User',
		},
		message: {
			type: String,
			default: '',
		},
		content: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
	},
);

schema.index({ roomId: 1, createdAt: -1 });

export const MessageModel = model<Message>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
