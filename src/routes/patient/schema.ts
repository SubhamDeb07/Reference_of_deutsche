import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';

export default {
	search: Joi.object().keys({
		searchVal: Joi.string(),
	}),
	getById: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
	getPatientById: Joi.object().keys({
		userId: Joi.string()
			.required()
			.length(7)
			.messages({ 'string.length': 'User ID not valid' }),
	}),
	getPatientByClinicId: Joi.object().keys({
		page: Joi.number().min(1),
		limit: Joi.number().min(1),
		clinic: JoiObjectId().required(),
		searchQuery: Joi.string(),
	}),
};
