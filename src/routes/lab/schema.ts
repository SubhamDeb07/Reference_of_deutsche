import Joi from 'joi';
import { RoleCode } from '../../database/Role/model';
const allowedRoles = [
	RoleCode.DELIVERY_COORDINATOR,
	RoleCode.PRODUCTION_MANAGER,
	RoleCode.TREATMENT_PLANNER,
];

export default {
	updateLab: Joi.object().keys({
		isImpressionRequired: Joi.boolean(),
	}),
	getPaginated: Joi.object().keys({
		pageNumber: Joi.number().required().min(1),
		limit: Joi.number().required().min(1).max(10),
	}),
	getUsers: Joi.object().keys({
		pageNumber: Joi.number().required().min(1),
		limit: Joi.number().required().min(1).max(10),
		role: Joi.string()
			.valid('ALL', ...Object.values(allowedRoles))
			.required(),
		searchQuery: Joi.string().optional(),
	}),
	createLabUser: Joi.object().keys({
		name: Joi.string().min(1).max(100).required(),
		phoneNumber: Joi.number().optional().allow('', null),
		isOnWhatsapp: Joi.boolean().required(),
		email: Joi.string()
			.required()
			.messages({ 'string.email': 'Invalid email' }),
		role: Joi.string()
			.valid(...Object.values(allowedRoles))
			.required(),
		countryCode: Joi.string().optional().allow('', null),
	}),
};
