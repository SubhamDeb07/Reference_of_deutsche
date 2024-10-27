import mongoose, { Schema, model, Types } from 'mongoose';
import User from '../User/model';

export const DOCUMENT_NAME = 'Notifications';
export const COLLECTION_NAME = 'notfications';

export enum NotificationType {
	INQUIRY_ASSIGNED = 'INQUIRY_ASSIGNED',
	IMPRESSION_DELIVERED = 'IMPRESSION_DELIVERED',
	QUOTE_APPROVED = 'QUOTE_APPROVED',
	QUOTE_REWORK = 'QUOTE_REWORK',
	NEW_DENTIST_CREATED = 'NEW_DENTIST_CREATED',
	ASSIGN_TREATMENT_PLANNER = 'ASSIGN_TREATMENT_PLANNER',
	PLANNER_SET_ESTIMATE = 'PLANNER_SET_ESTIMATE',
	ASSIGN_PRODUCTION = 'ASSIGN_PRODUCTION',
	PRODUCTION_SET_ESTIMATE = 'PRODUCTION_SET_ESTIMATE',
	SUBMIT_PRODUCTION = 'SUBMIT_PRODUCTION',
	SUBMIT_PRESENTATION = 'SUBMIT_PRESENTATION',
	SHIP_ORDER = 'SHIP_ORDER',
	NEW_MESSAGE = 'NEW_MESSAGE',
	ORDER_ASSIGNED = 'ORDER_ASSIGNED',
	ORDER_RECEIVED = 'ORDER_RECEIVED',
	QUOTE_RECEIVED = 'QUOTE_RECEIVED',
	UPDATE_PRIVILEGE = 'UPDATE_PRIVILEGE',
	APPROVE_ORDER = 'APPROVE_ORDER',
	ORDER_APPROVED = 'ORDER_APPROVED',
	INQUIRY_RECEIVED = 'INQUIRY_RECEIVED',
	SUBMIT_IMPRESSION = 'SUBMIT_IMPRESSION',
	QUOTE_REVIEWED = 'QUOTE_REVIEWED',
	CLINIC_UPDATED = 'CLINIC_UPDATED',
	BALANCE_UPDATED = 'BALANCE_UPDATED',
	DUE_AMOUNT = 'DUE_AMOUNT',
	ORDER_SHIPPED = 'ORDER_SHIPPED',
	APPROVE_PRESENTATION = 'APPROVE_PRESENTATION',
	RECEIVE_ORDER = 'RECEIVE_ORDER',
}

export enum AssociatedType {
	INQUIRY = 'INQUIRY',
	ORDER = 'ORDER',
	DENTIST = 'DENTIST',
	SUB_ORDER = 'SUB_ORDER',
	CHAT_ROOM = 'CHAT_ROOM',
	CLINIC = 'CLINIC',
	USER_ID = 'USER_ID',
	USER = 'USER',
}

export interface MessageDetails {
	patient: User | Types.ObjectId | null;
	sender: User | Types.ObjectId | null;
}

export default interface Notification {
	_id: Types.ObjectId;
	user: Types.ObjectId | User;
	type: NotificationType;
	description: string;
	email?: string;
	whatsapp?: string;
	whatsappTemplateName?: string;
	whatsappVars?: [];
	isRead: boolean;
	messageDetails?: MessageDetails;
	associatedId: Types.ObjectId | string;
	associatedType: AssociatedType;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Notification>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		type: {
			type: Schema.Types.String,
			enum: Object.values(NotificationType),
			required: true,
			index: true,
		},
		description: {
			type: Schema.Types.String,
			required: true,
		},
		email: {
			type: Schema.Types.String,
		},
		whatsapp: {
			type: Schema.Types.String,
		},
		whatsappTemplateName: {
			type: Schema.Types.String,
		},
		whatsappVars: {
			type: Schema.Types.Array,
		},
		messageDetails: {
			type: {
				patient: {
					type: Schema.Types.ObjectId,
					ref: 'User',
				},
				sender: {
					type: Schema.Types.ObjectId,
					ref: 'User',
				},
			},
			default: {},
		},
		isRead: {
			type: Schema.Types.Boolean,
			default: false,
			index: true,
		},
		associatedId: {
			type: String,
			required: true,
		},
		associatedType: {
			type: Schema.Types.String,
			enum: Object.values(AssociatedType),
			required: true,
		},
	},
	{ timestamps: true },
);

export const NotificationModel = model<Notification>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
