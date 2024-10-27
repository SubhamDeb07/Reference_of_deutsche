import { Schema, model, Types } from 'mongoose';

export const DOCUMENT_NAME = 'Task';
export const COLLECTION_NAME = 'tasks';

export enum TaskType {
	DUE_PAYMENT = 'DUE_PAYMENT',
	APPROVE_DENTIST = 'APPROVE_DENTIST',
	APPROVE_QUOTE = 'APPROVE_QUOTE',
	SUBMIT_PRODUCTION = 'SUBMIT_PRODUCTION',
	SET_PRODUCTION_ESTIMATE_DATE = 'SET_PRODUCTION_ESTIMATE_DATE',
	SET_QUOTE_ESTIMATE_DATE = 'SET_QUOTE_ESTIMATE_DATE',
	SUBMIT_PRESENTATION = 'SUBMIT_PRESENTATION',
	SHIP_ORDER = 'SHIP_ORDER',
	REVIEW_PRESENTATION = 'REVIEW_PRESENTATION',
	SUBMIT_IMPRESSION = 'SUBMIT_IMPRESSION',
	APPROVE_ORDER = 'APPROVE_ORDER',
	RECEIVE_ORDER = 'RECEIVE_ORDER',
}

export interface TaskDetails {
	inquiry?: Types.ObjectId;
	dentist?: Types.ObjectId;
	order?: Types.ObjectId;
	subOrder?: Types.ObjectId;
	clinic?: Types.ObjectId;
}

export default interface Task {
	_id: Types.ObjectId;
	type: TaskType;
	isFulfilled: boolean;
	dueDate: Date;
	details: TaskDetails;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Task>(
	{
		type: {
			type: String,
			enum: Object.values(TaskType),
			required: true,
		},
		isFulfilled: {
			type: Boolean,
			default: false,
		},
		dueDate: {
			type: Date,
			required: true,
		},
		details: {
			dentist: {
				type: Schema.Types.ObjectId,
				ref: 'User',
			},
			inquiry: {
				type: Schema.Types.ObjectId,
				ref: 'Inquiry',
			},
			order: {
				type: Schema.Types.ObjectId,
				ref: 'Order',
			},
			clinic: {
				type: Schema.Types.ObjectId,
				ref: 'Clinic',
			},
			subOrder: {
				type: Schema.Types.ObjectId,
			},
		},
	},
	{
		timestamps: true,
	},
);

export const TaskModel = model<Task>(DOCUMENT_NAME, schema, COLLECTION_NAME);
