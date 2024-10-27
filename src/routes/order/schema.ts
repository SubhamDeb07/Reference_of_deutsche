import Joi from 'joi';
import { JoiObjectId } from '../../helpers/validator';
import { DeliveryType } from '../../database/Order/model';

export default {
	receiveOrder: Joi.object().keys({
		patientId: JoiObjectId().required(),
	}),
	placeSubOrder: Joi.object().keys({
		order: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
	}),
	reviewOrders: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string().optional(),
	}),
	getAll: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string().optional(),
		deliveryCoordinator: JoiObjectId(),
		filter: Joi.string()
			.valid('ALL', 'NEW', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED')
			.required(),
		sortField: Joi.string()
			.valid('productionEstimationDate', 'quoteStatus')
			.optional(),
		sortOrder: Joi.string().valid('asc', 'desc').optional(),
	}),
	getAllClinic: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string().optional(),
		filter: Joi.string()
			.valid('ALL', 'MANUFACTURING', 'SHIPPED', 'DELIVERED', 'CANCELED')
			.required(),
	}),
	myProductionOrders: Joi.object().keys({
		page: Joi.number().min(1).required(),
		limit: Joi.number().min(1).required(),
		searchQuery: Joi.string().optional(),
		productionManager: JoiObjectId(),
		filter: Joi.string()
			.valid('NEW', 'IN_PROGRESS', 'COMPLETED', 'SHIPPED')
			.required(),
	}),
	assignProductionManager: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		productionManager: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
	}),
	selfAssignProductionManager: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
	}),
	setProductionEstimation: Joi.object().keys({
		date: Joi.string().isoDate().required(),
		inquiry: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
	}),
	assignDelivery: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
		aligners: Joi.number().required(),
	}),
	getById: Joi.object().keys({
		id: JoiObjectId().required(),
	}),
	shipProduct: Joi.object().keys({
		inquiry: JoiObjectId().required(),
		subOrder: JoiObjectId().required(),
		deliveryMethod: Joi.string()
			.valid(...Object.values(DeliveryType))
			.required(),
		trackingId: Joi.string().when('deliveryMethod', {
			is: Joi.valid(DeliveryType.FEDEX, DeliveryType.DHL),
			then: Joi.string().required(),
			otherwise: Joi.string().optional(),
		}),
		aligners: Joi.number().required(),
	}),
	report: Joi.object().keys({
		startDate: Joi.string().isoDate().required(),
		endDate: Joi.string().isoDate().required(),
		clinicId: Joi.string().required(),
	}),
};
