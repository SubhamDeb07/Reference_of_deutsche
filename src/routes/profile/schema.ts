import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';
import { ApprovalStatus } from '../../database/User/model';

export default {
	userId: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
	profile: Joi.object().keys({
		name: Joi.string().min(1).max(200).optional(),
		profilePicUrl: Joi.string().uri().allow(''),
		email: Joi.string()
			.email()
			.optional()
			.messages({ 'string.email': 'Invalid email' }),
		phoneNumber: Joi.number().optional().allow('', null),
		countryCode: Joi.string().optional().allow('', null),
		address: Joi.object().keys({
			country: Joi.number(),
			city: Joi.number(),
			street: Joi.string(),
		}),
	}),
	setPrivilege: Joi.object().keys({
		user: JoiObjectId().required(),
		readPricing: Joi.bool().optional(),
		createOrder: Joi.bool().optional(),
		createDentist: Joi.bool().optional(),
		updateClinic: Joi.bool().optional(),
	}),
	approveDentist: Joi.object().keys({
		status: Joi.string()
			.valid(ApprovalStatus.APPROVED, ApprovalStatus.REJECTED)
			.required(),
		dentistId: JoiObjectId().required(),
	}),
	updateLabUser: Joi.object().keys({
		name: Joi.string().min(1).max(200),
		profilePicUrl: Joi.string().uri(),
		email: Joi.string().email().messages({ 'string.email': 'Invalid email' }),
		phoneNumber: Joi.number().optional().allow('', null),
		countryCode: Joi.string().optional().allow('', null),
		isActive: Joi.bool(),
	}),
};
