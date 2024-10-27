import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';
import { ApprovalStatus } from '../../database/User/model';

const Address = Joi.object().keys({
	country: Joi.number().required().min(1),
	city: Joi.number().required().min(1),
	street: Joi.string().required(),
});

export default {
	createDentist: Joi.object().keys({
		profilePicUrl: Joi.string().uri().required(),
		name: Joi.string().min(1).max(200).required(),
		phoneNumber: Joi.number().optional().allow('', null),
		countryCode: Joi.string().optional().allow('', null),
		isOnWhatsapp: Joi.bool().required(),
		email: Joi.string()
			.email()
			.required()
			.messages({ 'string.email': 'Invalid email' }),
		gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
		address: Address.required(),
		clinic: JoiObjectId().required(),
		privilege: Joi.object().keys({
			readPricing: Joi.boolean().required(),
			createOrder: Joi.boolean().required(),
			createDentist: Joi.boolean().required(),
			updateClinic: Joi.boolean().required(),
		}),
	}),
	getAllByFilter: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		approvalStatus: Joi.string()
			.valid(...Object.values(ApprovalStatus), 'ALL')
			.required(),
		searchQuery: Joi.string().allow('', null),
		clinic: JoiObjectId().optional().allow(null),
	}),
	getById: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
	updateDentist: Joi.object().keys({
		name: Joi.string().min(1).max(200),
		profilePicUrl: Joi.string().uri().allow(''),
		email: Joi.string().email(),
		phoneNumber: Joi.number().optional().allow('', null),
		countryCode: Joi.string().optional().allow('', null),
		address: Joi.object().keys({
			country: Joi.number(),
			city: Joi.number(),
			street: Joi.string(),
		}),
		isActive: Joi.boolean(),
	}),
};
