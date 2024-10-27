import { Schema, model, Types } from 'mongoose';

export const DOCUMENT_NAME = 'Role';
export const COLLECTION_NAME = 'roles';

export enum RoleCode {
	ADMIN = 'ADMIN',
	LAB_ADMIN = 'LAB_ADMIN',
	TREATMENT_PLANNER = 'TREATMENT_PLANNER',
	PRODUCTION_MANAGER = 'PRODUCTION_MANAGER',
	DELIVERY_COORDINATOR = 'DELIVERY_COORDINATOR',
	DENTIST_ADMIN = 'DENTIST_ADMIN',
	DENTIST = 'DENTIST',
	PATIENT = 'PATIENT',
}

export default interface Role {
	_id: Types.ObjectId;
	code: RoleCode;
	status?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Role>(
	{
		code: {
			type: Schema.Types.String,
			required: true,
			enum: Object.values(RoleCode),
		},
		status: {
			type: Schema.Types.Boolean,
			default: true,
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

schema.index({ code: 1, status: 1 });

export const RoleModel = model<Role>(DOCUMENT_NAME, schema, COLLECTION_NAME);
