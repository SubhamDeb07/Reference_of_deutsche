import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';

import {
	ArchSide,
	ImpressionType,
	Anterior,
	OverJet,
	OverBite,
	BiteRamps,
	MidLine,
	Spacing,
} from '../../database/Inquiry/model';
import { ProductType } from '../../database/Inquiry/types';
import { DeliveryType } from '../../database/Order/model';

const Patient = Joi.object().keys({
	profilePicUrl: Joi.string().uri(),
	name: Joi.string().min(1).max(200).required().messages({
		'string.base': 'Invalid name',
		'string.min': 'Name must be at least 1 character long',
		'any.required': 'Name is required',
	}),
	phoneNumber: Joi.number().optional().allow('', null),
	countryCode: Joi.string().optional().allow('', null),
	email: Joi.string()
		.email()
		.messages({ 'string.email': 'Please enter a valid mail' }),
	gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
	dob: Joi.date().optional(),
});

export default {
	createInquiry: Joi.object().keys({
		order: Joi.object()
			.keys({
				prodType: Joi.string()
					.valid(...Object.values(ProductType))
					.required()
					.messages({
						'any.only': 'Filter must be one of ALIGNER, REFINER, RETAINER',
						'any.required': 'Please select one of the product type',
					}),
				archSide: Joi.when('prodType', {
					is: Joi.valid(ProductType.ALIGNER),
					then: Joi.string()
						.valid(...Object.values(ArchSide))
						.required(),
					otherwise: Joi.string().forbidden(),
				}),
				impressionType: Joi.string()
					.valid(...Object.values(ImpressionType))
					.required(),
				impressionFiles: Joi.when('impressionType', {
					is: Joi.valid(ImpressionType.SOFT_COPY),
					then: Joi.array().items(Joi.string().uri()).required(),
					otherwise: Joi.array().items().length(0),
				}),
				externalImages: Joi.array().items(Joi.string().uri()),
				notificationsType: Joi.array().items(
					Joi.string().valid('WHATSAPP', 'EMAIL'),
				),
				treatmentDetails: Joi.object().keys({
					restrictedTooth: Joi.array().items(Joi.number()),
					extractedTooth: Joi.array().items(Joi.number()),
					iprTooth: Joi.array().items(
						Joi.object().keys({
							position: Joi.number(),
							space: Joi.number(),
						}),
					),
					note: Joi.string().allow(''),
					anterior: Joi.string().valid(...Object.values(Anterior)),
					overJet: Joi.string().valid(...Object.values(OverJet)),
					overBite: Joi.string().valid(...Object.values(OverBite)),
					biteRamps: Joi.string().valid(...Object.values(BiteRamps)),
					midLine: Joi.string().valid(...Object.values(MidLine)),
					spacing: Joi.string().valid(...Object.values(Spacing)),
					spacingCrowding: Joi.array().items(Joi.number()),
				}),
			})
			.required(),
		patient: Joi.when('order.prodType', {
			is: Joi.valid(ProductType.ALIGNER),
			then: Patient.required(),
			otherwise: Patient.forbidden(),
		}),
		patientId: Joi.when('order.prodType', {
			is: Joi.valid(ProductType.REFINER, ProductType.RETAINER),
			then: JoiObjectId().required(),
			otherwise: Joi.forbidden(),
		}),
	}),
	receiveImpression: Joi.object().keys({
		patientId: JoiObjectId()
			.required()
			.messages({ 'any.required': 'Patient ID not valid' }),
	}),
	getById: Joi.object().keys({
		inquiryId: JoiObjectId().required(),
	}),
	getByInquiryId: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
	addShipment: Joi.object().keys({
		inquiryId: JoiObjectId().required(),
		shipmentMethod: Joi.string()
			.required()
			.valid(...Object.values(DeliveryType)),
		trackingId: Joi.string().when('shipmentMethod', {
			is: Joi.valid(DeliveryType.FEDEX, DeliveryType.DHL),
			then: Joi.string().required(),
			otherwise: Joi.string().optional(),
		}),
	}),
	getWithSearchFilterPaginated: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string().valid(
			'NEW_INQUIRES',
			'IN_PROGRESS',
			'PENDING_APPROVAL',
			'COMPLETED',
			'IMPRESSION_PENDING',
		),
		searchQuery: Joi.string().optional(),
		sortField: Joi.string()
			.valid('quoteEstimationDate', 'quoteStatus')
			.optional(),
		sortOrder: Joi.string().valid('asc', 'desc').optional(),
	}),
	getNewWithSearchFilterPaginated: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string()
			.valid('ALL_IMPRESSIONS', 'STL_IMPRESSION', 'PHYSICAL_IMPRESSION')
			.default('ALL'),
		searchQuery: Joi.string().optional(),
	}),
	getMyWithSearchFilterPaginated: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string().valid(
			'NEW_ASSIGNED',
			'IN_PROGRESS',
			'PENDING_APPROVAL',
			'COMPLETED',
		),
		searchQuery: Joi.string().optional(),
		treatmentPlanner: JoiObjectId(),
	}),
	assignTreatmentPlanner: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		treatmentPlanner: JoiObjectId().required(),
	}),
	selfAssignInquiry: Joi.object().keys({
		inquiry: JoiObjectId().required(),
	}),
	getImpressionInquires: Joi.object().keys({
		filter: Joi.string().valid('PENDING', 'IN_PROGRESS', 'DELIVERED'),
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string().allow('').optional(),
	}),
	treatmentPlans: Joi.object().keys({
		filter: Joi.string()
			.valid('ALIGNER', 'REFINER', 'RETAINER')
			.required()
			.messages({
				'any.only': 'Filter must be one of ALIGNER, REFINER, RETAINER',
				'any.required': 'Please select one of the filter',
			}),
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
	}),
};
