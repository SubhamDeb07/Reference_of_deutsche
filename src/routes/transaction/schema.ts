import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';

export default {
	createTransaction: Joi.object().keys({
		amount: Joi.number().required(),
		type: Joi.string().required(),
		clinic: Joi.string().required(),
	}),
	getByFilter: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string(),
	}),
	getClinicsWithFilter: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string(),
		filter: Joi.string().valid('PENDING', 'COMPLETED').required(),
	}),
};
