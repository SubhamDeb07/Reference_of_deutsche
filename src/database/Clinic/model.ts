import { Schema, model, Types } from 'mongoose';
import Country from '../Country/model';
import City from '../City/model';
import Lab from '../Lab/model';

export const DOCUMENT_NAME = 'Clinic';
export const COLLECTION_NAME = 'clinics';

export enum ShipmentMethod {
	COURIER = 'COURIER',
	SELF = 'SELF',
}

export interface Address {
	country: Country | Types.ObjectId;
	city: City | Types.ObjectId;
	street: string;
}

export enum PricingType {
	PER_ALIGNER = 'PER_ALIGNER',
	PER_CASE = 'PER_CASE',
}

export enum Currency {
	AED = 'AED',
	USD = 'USD',
	EUR = 'EUR',
}

export interface PricingPlan {
	type: PricingType;
	currency: Currency;
	price?: number;
	simpleCasePrice?: number;
	moderateCasePrice?: number;
	complexCasePrice?: number;
}

export default interface Clinic {
	_id: Types.ObjectId;
	name: string;
	profilePicUrl: string;
	email: string;
	phoneNumber: number;
	countryCode: string;
	address: Address;
	shipmentMethod: ShipmentMethod;
	pricingPlan: PricingPlan;
	lab: Lab | Types.ObjectId;
	isActive: boolean;
	dueAmount: number;
	paidAmount: number;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Clinic>(
	{
		name: Schema.Types.String,
		profilePicUrl: Schema.Types.String,
		email: Schema.Types.String,
		phoneNumber: Schema.Types.Number,
		countryCode: Schema.Types.String,
		lab: {
			type: Schema.Types.ObjectId,
			ref: 'Lab',
			required: true,
		},
		address: {
			country: {
				type: Schema.Types.Number,
				ref: 'Country',
				required: true,
			},
			city: {
				type: Schema.Types.Number,
				ref: 'City',
				required: true,
			},
			street: Schema.Types.String,
		},
		shipmentMethod: {
			type: Schema.Types.String,
			enum: Object.values(ShipmentMethod),
		},
		pricingPlan: {
			type: {
				type: Schema.Types.String,
				enum: Object.values(PricingType),
			},
			currency: {
				type: Schema.Types.String,
				enum: Object.values(Currency),
				required: true,
			},
			price: Schema.Types.Number,
			simpleCasePrice: Schema.Types.Number,
			moderateCasePrice: Schema.Types.Number,
			complexCasePrice: Schema.Types.Number,
		},
		isActive: { type: Schema.Types.Boolean, default: true },
		dueAmount: {
			type: Schema.Types.Number,
			default: 0,
		},
		paidAmount: {
			type: Schema.Types.Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	},
);

schema.index({ name: 'text' });
schema.index({ email: 'text' });

export const ClinicModel = model<Clinic>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
