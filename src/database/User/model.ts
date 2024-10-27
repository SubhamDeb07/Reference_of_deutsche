import { model, Schema, Types } from 'mongoose';
import Role from '../Role/model';
import Lab from '../Lab/model';
import Clinic from '../Clinic/model';
import Country from '../Country/model';
import City from '../City/model';

export const DOCUMENT_NAME = 'User';
export const COLLECTION_NAME = 'users';

export enum Gender {
	MALE = 'MALE',
	FEMALE = 'FEMALE',
	OTHER = 'OTHER',
}

export enum ApprovalStatus {
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED',
}

export interface Address {
	country: Country | Types.ObjectId; // model
	city: City | Types.ObjectId; // model
	street: string;
}

export interface Privilege {
	readPricing: boolean;
	createOrder: boolean;
	createDentist: boolean;
	updateClinic: boolean;
}

export default interface User {
	_id: Types.ObjectId;
	userId: string;
	profilePicUrl: string;
	name: string;
	phoneNumber: number;
	countryCode: string;
	email: string;
	gender: Gender;
	address: Address;
	dob?: Date;
	password?: string;
	role: Role | Types.ObjectId;
	privilege: Privilege;
	isActive: boolean;
	approvalStatus: ApprovalStatus;
	isPermissionAdded: boolean;
	verificationToken: {
		token: string | null;
		expiresAt: Date | null;
	} | null;
	dentist?: User | Types.ObjectId;
	lab: Lab | Types.ObjectId;
	clinic?: Clinic | Types.ObjectId;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<User>(
	{
		userId: {
			type: Schema.Types.String,
		},
		profilePicUrl: {
			type: Schema.Types.String,
			trim: true,
		},
		name: {
			type: Schema.Types.String,
			trim: true,
			maxlength: 200,
			default: '',
		},
		phoneNumber: {
			type: Schema.Types.Number,
		},
		countryCode: {
			type: Schema.Types.String,
		},
		email: {
			type: Schema.Types.String,
			trim: true,
			select: false,
		},
		dob: {
			type: Schema.Types.Date,
			required: false,
			default: null,
		},
		gender: {
			type: Schema.Types.String,
			enum: Object.values(Gender),
		},
		lab: {
			type: Schema.Types.ObjectId,
			ref: 'Lab',
			required: true,
		},
		clinic: {
			type: Schema.Types.ObjectId,
			ref: 'Clinic',
		},
		dentist: {
			type: Schema.Types.ObjectId,
			ref: 'Dentist',
		},
		address: {
			country: {
				type: Schema.Types.Number,
				ref: 'Country',
			},
			city: {
				type: Schema.Types.Number,
				ref: 'City',
			},
			street: Schema.Types.String,
		},
		password: {
			type: Schema.Types.String,
			select: false,
		},
		role: {
			type: Schema.Types.ObjectId,
			ref: 'Role',
			required: true,
			select: false,
		},
		privilege: {
			readPricing: { type: Schema.Types.Boolean, default: false },
			createOrder: { type: Schema.Types.Boolean, default: false },
			createDentist: { type: Schema.Types.Boolean, default: false },
			updateClinic: { type: Schema.Types.Boolean, default: false },
		},
		isActive: { type: Schema.Types.Boolean, default: true },
		approvalStatus: {
			type: Schema.Types.String,
			enum: Object.values(ApprovalStatus),
			default: ApprovalStatus.PENDING,
		},
		isPermissionAdded: { type: Schema.Types.Boolean, default: false },
		verificationToken: {
			token: Schema.Types.String,
			expiresAt: Schema.Types.Date,
		},
		createdAt: {
			type: Schema.Types.Date,
			required: true,
			select: false,
		},
		updatedAt: {
			type: Schema.Types.Date,
			required: true,
			select: false,
		},
	},
	{
		versionKey: false,
	},
);

schema.index({ name: 'text', email: 'text', userId: 'text' });
schema.index({ email: 1 });
schema.index({ userId: 1 });

export const UserModel = model<User>(DOCUMENT_NAME, schema, COLLECTION_NAME);
