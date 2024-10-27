import { Schema, model, Types } from 'mongoose';
import Clinic from '../Clinic/model';
import Lab from '../Lab/model';

export const DOCUMENT_NAME = 'Transaction';
export const COLLECTION_NAME = 'transactions';

export enum PaymentMode {
	DEBIT = 'DEBIT',
	CREDIT = 'CREDIT',
	CASH = 'CASH',
	NET = 'NET',
}

export default interface Transaction {
	_id: Types.ObjectId;
	clinic: Clinic | Types.ObjectId;
	lab: Lab | Types.ObjectId;
	amount: number;
	paymentMode: PaymentMode;
	createdAt: Date;
	updatedAt: Date;
}
const schema = new Schema<Transaction>(
	{
		clinic: {
			type: Schema.Types.ObjectId,
			ref: 'Clinic',
			required: true,
		},
		lab: {
			type: Schema.Types.ObjectId,
			ref: 'Lab',
			required: true,
		},
		amount: {
			type: Schema.Types.Number,
			required: true,
		},
		paymentMode: {
			type: Schema.Types.String,
			enum: Object.values(PaymentMode),
			required: true,
		},
	},
	{ timestamps: true },
);

export const TransactionModel = model<Transaction>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
