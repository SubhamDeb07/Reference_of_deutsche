import Joi from 'joi';
import { Currency, PricingType } from '../../database/Clinic/model';
import { JoiObjectId } from '../../helpers/validator';

const Address = Joi.object().keys({
	country: Joi.number().required().min(1),
	city: Joi.number().required().min(1),
	street: Joi.string().required(),
});

const Clinic = Joi.object().keys({
	name: Joi.string().min(1).max(200).required(),
	profilePicUrl: Joi.string().uri().required(),
	email: Joi.string()
		.email()
		.required()
		.messages({ 'string.email': 'Invalid Clinic email' }),
	phoneNumber: Joi.number().optional().allow('', null),
	countryCode: Joi.string().optional().allow('', null),
	address: Address.required(),
	shipmentMethod: Joi.string().valid('COURIER', 'SELF').required(),
	pricingPlan: Joi.object()
		.keys({
			type: Joi.string().valid('PER_ALIGNER', 'PER_CASE').required(),
			currency: Joi.string()
				.required()
				.valid(...Object.values(Currency)),
			price: Joi.number().when('type', {
				is: Joi.valid('PER_ALIGNER'),
				then: Joi.number().required(),
				otherwise: Joi.number().forbidden(),
			}),
			simpleCasePrice: Joi.number().when('type', {
				is: Joi.valid('PER_CASE'),
				then: Joi.number().required(),
				otherwise: Joi.number().forbidden(),
			}),
			moderateCasePrice: Joi.number().when('type', {
				is: Joi.valid('PER_CASE'),
				then: Joi.number().required(),
				otherwise: Joi.number().forbidden(),
			}),
			complexCasePrice: Joi.number().when('type', {
				is: Joi.valid('PER_CASE'),
				then: Joi.number().required(),
				otherwise: Joi.number().forbidden(),
			}),
		})
		.required(),
});

const Dentist = Joi.object().keys({
	profilePicUrl: Joi.string().uri().required(),
	name: Joi.string().min(1).max(200).required(),
	phoneNumber: Joi.number().optional().allow('', null),
	countryCode: Joi.string().optional().allow('', null),
	isOnWhatsapp: Joi.bool().required(),
	email: Joi.string()
		.email()
		.required()
		.messages({ 'string.email': 'Invalid Dentist email' }),
	gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
	address: Address.required(),
});

export default {
	createClinic: Joi.object().keys({
		clinic: Clinic.required(),
		dentist: Dentist.required(),
	}),
	search: Joi.object().keys({
		searchVal: Joi.string(),
	}),
	updateClinic: Joi.object().keys({
		name: Joi.string().min(1).max(200),
		profilePicUrl: Joi.string().uri().allow(''),
		email: Joi.string().email().messages({ 'string.email': 'Invalid email' }),
		phoneNumber: Joi.number().allow('', null),
		isActive: Joi.bool(),
		countryCode: Joi.string().allow('', null),
		address: Joi.object().keys({
			country: Joi.number(),
			city: Joi.number(),
			street: Joi.string(),
		}),
	}),
	updatePricingPlan: Joi.object().keys({
		type: Joi.string()
			.valid(...Object.values(PricingType))
			.required(),
		currency: Joi.string()
			.valid(...Object.values(Currency))
			.required(),
		price: Joi.number().when('type', {
			is: Joi.valid(PricingType.PER_ALIGNER),
			then: Joi.number().required(),
			otherwise: Joi.number().forbidden(),
		}),
		simpleCasePrice: Joi.number().when('type', {
			is: Joi.valid(PricingType.PER_CASE),
			then: Joi.number().required(),
			otherwise: Joi.number().forbidden(),
		}),
		moderateCasePrice: Joi.number().when('type', {
			is: Joi.valid(PricingType.PER_CASE),
			then: Joi.number().required(),
			otherwise: Joi.number().forbidden(),
		}),
		complexCasePrice: Joi.number().when('type', {
			is: Joi.valid(PricingType.PER_CASE),
			then: Joi.number().required(),
			otherwise: Joi.number().forbidden(),
		}),
	}),
	getByFilter: Joi.object().keys({
		searchVal: Joi.string(),
		page: Joi.number().min(1),
		limit: Joi.number().min(1),
	}),
	getById: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
};
