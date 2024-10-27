import { Schema, model, Types } from 'mongoose';
import Country from '../Country/model';

export const DOCUMENT_NAME = 'City';
export const COLLECTION_NAME = 'cities';

export default interface City {
	_id: number;
	name: string;
	country: Country | Types.ObjectId;
	state: number;
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<City>(
	{
		_id: {
			type: Schema.Types.Number,
			required: true,
		},
		name: {
			type: Schema.Types.String,
			required: [true, 'City name is required'],
		},
		country: {
			type: Schema.Types.Number,
			ref: 'Country',
			required: [true, 'country is required'],
		},
		state: {
			type: Schema.Types.Number,
			// ref to state model
		},
	},
	{
		timestamps: true,
	},
);

export const CityModel = model<City>(DOCUMENT_NAME, schema, COLLECTION_NAME);
