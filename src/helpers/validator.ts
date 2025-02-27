import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import Logger from '../core/Logger';
import { BadRequestError } from '../core/ApiError';
import { Types } from 'mongoose';

export enum ValidationSource {
	BODY = 'body',
	HEADER = 'headers',
	QUERY = 'query',
	PARAM = 'params',
}

type ObjectIdOrPopulated =
	| Types.ObjectId
	| { _id: Types.ObjectId }
	| { $oid: string };

export const extractObjectId = (value: ObjectIdOrPopulated): Types.ObjectId => {
	if (value instanceof Types.ObjectId) {
		return value;
	} else if (value && typeof value === 'object') {
		if ('_id' in value) {
			return value._id;
		} else if ('$oid' in value) {
			return new Types.ObjectId(value['$oid']);
		}
	}

	throw new Error(
		"Invalid input: value is neither an ObjectId nor an object containing an _id or '$oid'.",
	);
};

export const JoiObjectId = () =>
	Joi.string().custom((value: string, helpers) => {
		if (!Types.ObjectId.isValid(value)) return helpers.error('any.invalid');
		return value;
	}, 'Object Id Validation');

export const JoiUrlEndpoint = () =>
	Joi.string().custom((value: string, helpers) => {
		if (value.includes('://')) return helpers.error('any.invalid');
		return value;
	}, 'Url Endpoint Validation');

export const JoiAuthBearer = () =>
	Joi.string().custom((value: string, helpers) => {
		if (!value.startsWith('Bearer ')) return helpers.error('any.invalid');
		if (!value.split(' ')[1]) return helpers.error('any.invalid');
		return value;
	}, 'Authorization Header Validation');

export default (
		schema: Joi.AnySchema,
		source: ValidationSource = ValidationSource.BODY,
	) =>
	(req: Request, res: Response, next: NextFunction) => {
		try {
			const { error } = schema.validate(req[source]);

			if (!error) return next();

			const { details } = error;
			const message = details
				.map((i) => i.message.replace(/['"]+/g, ''))
				.join(',');
			Logger.error(message);

			next(new BadRequestError(message));
		} catch (error) {
			next(error);
		}
	};
