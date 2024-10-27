import { Schema, model, Types } from 'mongoose';
import { Currency } from '../Clinic/model';

export const DOCUMENT_NAME = 'Lab';
export const COLLECTION_NAME = 'labs';

export default interface Lab {
	_id: Types.ObjectId;
	name: string;
	currency: Currency;
	isImpressionRequired: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Lab>(
	{
		name: {
			type: Schema.Types.String,
			required: true,
		},
		currency: {
			type: Schema.Types.String,
			required: true,
			enum: Object.values(Currency),
		},
		isImpressionRequired: {
			type: Schema.Types.Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	},
);

export const LabModel = model<Lab>(DOCUMENT_NAME, schema, COLLECTION_NAME);
