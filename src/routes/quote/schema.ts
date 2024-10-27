import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';
import {
	CaseComplexity,
	DeliveryType,
	QuoteStatus,
} from '../../database/Order/model';

export default {
	createQuote: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		quoteDetails: Joi.object().keys({
			caseComplexity: Joi.string()
				.valid(...Object.values(CaseComplexity))
				.required(),
			totalAligners: Joi.number().required().min(1).messages({
				'number.min': 'Total aligners must be greater than 0',
				'number.base': 'Aligners must be a number',
			}),
			note: Joi.string().optional().allow(''),
			presentationFolder: Joi.string().uuid().required(),
			presentationPdf: Joi.string().uri().required(),
		}),
	}),
	getWithSearchFilterPaginated: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string()
			.required()
			.valid(
				'ALL',
				'RECEIVED',
				'IN_PROGRESS',
				'IMPRESSION_PENDING',
				'COMPLETED',
				'CANCELED',
			),
		searchQuery: Joi.string().optional(),
	}),
	getReviewWithSearchFilterPaginated: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		filter: Joi.string().valid('PENDING', 'APPROVED', 'ALL').default('ALL'),
		searchQuery: Joi.string().optional(),
	}),
	placeOrder: Joi.object().keys({
		order: JoiObjectId().required(),
	}),
	placeOrderApproval: Joi.object().keys({
		order: JoiObjectId().required(),
		status: Joi.string().valid('APPROVE', 'REJECT'),
	}),
	cancelQuote: Joi.object().keys({
		order: JoiObjectId().required(),
	}),
	updateStatus: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		status: Joi.string().valid(...Object.values(QuoteStatus)),
		message: Joi.string().default(''),
	}),
	setEstimation: Joi.object().keys({
		date: Joi.string().isoDate().required(),
		inquiry: JoiObjectId().required(),
	}),
	revision: Joi.object().keys({
		order: JoiObjectId().required(),
		message: Joi.string().optional().allow(''),
	}),
};
