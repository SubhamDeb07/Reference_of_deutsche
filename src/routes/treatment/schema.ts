import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';

export default {
	getDetails: Joi.object().keys({
		patient: JoiObjectId().required(),
	}),
	getByClinic: Joi.object().keys({
		clinicId: JoiObjectId().required(),
		dentistId: JoiObjectId().optional(),
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string()
			.valid('ALL', 'ONGOING', 'COMPLETED', 'CANCELED')
			.default('ALL'),
		searchQuery: Joi.string().optional(),
	}),
};
