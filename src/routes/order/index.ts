import express from 'express';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import { BadRequestError } from '../../core/ApiError';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import { RoleCode } from '../../database/Role/model';
import OrderRepo from '../../database/Order/repo';
import InquiryRepo from '../../database/Inquiry/repo';
import UserRepo from '../../database/User/repo';
import ChatRoomRepo from '../../database/ChatRoom/repo';
import RoleRepo from '../../database/Role/repo';
import ClinicRepo from '../../database/Clinic/repo';
import LabRepo from '../../database/Lab/repo';
import _ from 'lodash';
import { Types } from 'mongoose';
import Order, {
	Delivery,
	DeliveryType,
	OrderStatus,
	QuoteStatus,
} from '../../database/Order/model';
import { orderEvent } from '../../events';
import { ProductType } from '../../database/Inquiry/types';
import { getJson } from '../../cache/query';
import { DynamicKey, getDynamicKey } from '../../cache/keys';
import Clinic, { Currency } from '../../database/Clinic/model';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.get(
	'/lab/getDeleted',
	role(RoleCode.LAB_ADMIN),
	asyncHandler(async (req: ProtectedRequest, res) => {
		console.log('asdad');
		const { searchQuery = '', page = 1, limit = 10 } = req.query;
		const data = await OrderRepo.getDeletedOrders(
			searchQuery as string,
			extractObjectId(req.user.lab),
			+page,
			+limit,
		);

		new SuccessResponse('Success', data).send(res);
	}),
);
router.put(
	'/receive',
	role(
		RoleCode.DENTIST,
		RoleCode.DENTIST_ADMIN,
		RoleCode.LAB_ADMIN,
		RoleCode.PRODUCTION_MANAGER,
	),
	authorization,
	validator(schema.receiveOrder, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { patientId } = req.body;

		const foundOrders = await OrderRepo.getPatientOrders(patientId);

		let orderId: Types.ObjectId | null = null;
		let subOrderId: Types.ObjectId | null = null;
		let newDeliveriesArray: Delivery[] = [];

		let found = false;
		foundOrders.forEach((order: Order) => {
			if (found) return;
			newDeliveriesArray = [];

			order.deliveries.forEach((del: Delivery) => {
				if (del.status === OrderStatus.IN_SHIPMENT) {
					orderId = order._id;
					subOrderId = del._id;
					del.status = OrderStatus.DELIVERED;
					found = true;
				}

				newDeliveriesArray.push(del);
			});
		});

		if (!found || !orderId) {
			throw new BadRequestError('Order yet to be dispatched.');
		}

		await OrderRepo.update({
			_id: orderId as Types.ObjectId,
			deliveries: newDeliveriesArray,
			stage: 'DELIVERED',
		} as Order);

		if (orderId && subOrderId) {
			orderEvent.onReceiveOrder(orderId, subOrderId);
		}

		return new SuccessResponse('Received', orderId).send(res);
	}),
);

router.put(
	'/place/suborder',
	authentication,
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.placeSubOrder, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { order, subOrder } = req.body;

		const foundOrder = await OrderRepo.findFieldsById(
			order,
			'deliveries',
			'quoteDetails',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');
		if (foundOrder.quoteDetails.status !== QuoteStatus.DENTIST_APPROVED)
			throw new BadRequestError('Dentist has not approved the quote.');

		let isSubOrder = false;
		const newDeliveriesArray = foundOrder.deliveries.map((deli) => {
			deli = JSON.parse(JSON.stringify(deli));

			if (deli._id == subOrder) {
				isSubOrder = true;
				if (deli.status !== OrderStatus.PENDING)
					throw new BadRequestError('Already in progress');

				return {
					...deli,
					status: OrderStatus.DENTIST_APPROVED,
				};
			}

			if (
				[OrderStatus.PENDING, OrderStatus.DELIVERED].includes(deli.status) !==
				true
			) {
				throw new BadRequestError('Other order is still in progress');
			}

			return deli;
		});

		if (!isSubOrder) throw new BadRequestError('suborder not found');

		const data = await OrderRepo.update({
			_id: order,
			deliveries: newDeliveriesArray,
		} as Order);

		return new SuccessResponse('success', _.pick(data, ['_id'])).send(res);
	}),
);

router.get(
	'/review',
	role(RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.reviewOrders, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchQuery = '', page = 1, limit = 10 } = req.query;

		const foundLab = await LabRepo.findFieldsById(
			extractObjectId(req.user.lab),
			'currency',
		);

		const foundClinic = await ClinicRepo.findFieldsById(
			extractObjectId(req.user.clinic as Types.ObjectId),
			'pricingPlan',
		);

		if (!foundLab || !foundClinic) throw new BadRequestError('Lab not found');

		const cachedExchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
		);

		let currency = 0;
		if (cachedExchangeRates) {
			const value = cachedExchangeRates[foundClinic.pricingPlan.currency];

			currency = Number(value);
		}

		const data = await OrderRepo.reviewOrdersWithSearchPaginated(
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			extractObjectId(req.user.clinic as Types.ObjectId),
		);

		data[0].forEach((order) => {
			order.quoteDetails.price = order.quoteDetails.price * Number(currency);
			order.clinic = foundClinic;
		});

		new SuccessResponse('Success', { orders: data[0], count: data[1] }).send(
			res,
		);
	}),
);

router.get(
	'/clinic/withfilter',
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.getAllClinic, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchQuery = '', page = 1, limit = 10, filter } = req.query;

		let isAdmin = false;
		const role = await RoleRepo.findByCode(RoleCode.DENTIST_ADMIN);

		if (role?._id.equals(req.user.role._id)) {
			isAdmin = true;
		}

		const data = await OrderRepo.getClinicOrdersWithSearchFilterPaginated(
			searchQuery as string,
			filter as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			extractObjectId(req.user.clinic as Types.ObjectId),
			isAdmin ? null : req.user._id,
		);

		new SuccessResponse('Success', {
			orders: data[0],
			count: data[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.get(
	'/lab/withfilter',
	role(
		RoleCode.LAB_ADMIN,
		RoleCode.PRODUCTION_MANAGER,
		RoleCode.DELIVERY_COORDINATOR,
	),
	authorization,
	validator(schema.getAll, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			searchQuery = '',
			page = 1,
			limit = 10,
			filter,
			sortField = 'deliveries.productionEstimationDate',
			sortOrder = 'desc',
		} = req.query;

		const data = await OrderRepo.getAllOrdersWithSearchFilterPaginated(
			searchQuery as string,
			filter as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			sortField as string,
			sortOrder as string,
		);

		new SuccessResponse('Success', {
			orders: data[0],
			count: data[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.get(
	'/my/productionorders',
	role(RoleCode.PRODUCTION_MANAGER, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.myProductionOrders, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			searchQuery = '',
			page = 1,
			limit = 10,
			filter,
			productionManager,
		} = req.query;

		const role = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

		if (!role) throw new BadRequestError('Role not found');

		const isLabAdmin = req.user.role._id.equals(role._id);

		if (isLabAdmin && !productionManager) {
			throw new BadRequestError('Production Manager is required');
		}

		const userId = isLabAdmin ? productionManager : req.user._id;

		const data = await OrderRepo.getMyProductionOrdersWithSearchFilterPaginated(
			searchQuery as string,
			filter as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			userId as Types.ObjectId,
		);

		new SuccessResponse('Success', {
			orders: data[0],
			count: data[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.get(
	'/lab/productionorders',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.myProductionOrders, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchQuery = '', page = 1, limit = 10, filter } = req.query;

		const role = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

		if (!role) throw new BadRequestError('Role not found');

		const userId = req.user._id;

		const data = await OrderRepo.getMyProductionOrdersWithSearchFilterPaginated(
			searchQuery as string,
			filter as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			userId as Types.ObjectId,
		);

		new SuccessResponse('Success', {
			orders: data[0],
			count: data[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.put(
	'/assign/production',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.assignProductionManager, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry, productionManager, subOrder } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'impressionStatus',
			'quoteStatus',
			'patient',
			'order',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

		const order = await OrderRepo.findFieldsById(
			foundInquiry.order! as Types.ObjectId,
			'deliveries',
		);

		if (!order) throw new BadRequestError('Order not found');

		let isSubOrder = false;
		const newDeliveriesArray = order.deliveries.map((deli) => {
			deli = JSON.parse(JSON.stringify(deli));

			if (deli._id == subOrder) {
				if (deli.productionManager)
					throw new BadRequestError('Production in progress');
				isSubOrder = true;

				return {
					...deli,
					productionManager,
				};
			}

			return deli;
		});

		if (!isSubOrder) throw new BadRequestError('suborder not found');

		const data = await OrderRepo.update({
			_id: foundInquiry.order,
			deliveries: newDeliveriesArray,
			stage: 'PRODUCTION_ASSIGNED',
			productionId: productionManager,
		} as Order);

		await ChatRoomRepo.addUsersToRoom(foundInquiry.patient.toString(), [
			productionManager,
		]);

		await ChatRoomRepo.addUsersToRoom(`lab${foundInquiry.patient.toString()}`, [
			productionManager,
		]);

		orderEvent.onAssignProduction(order._id, subOrder, productionManager);

		return new SuccessResponse(
			'success',
			_.pick(data, ['_id', 'productionManager', 'status']),
		).send(res);
	}),
);

router.put(
	'/production/setEstimation',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.PRODUCTION_MANAGER),
	authorization,
	validator(schema.setProductionEstimation, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { date, inquiry, subOrder } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'impressionStatus',
			'quoteStatus',
			'order',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

		const order = await OrderRepo.findFieldsById(
			foundInquiry.order! as Types.ObjectId,
			'deliveries',
		);

		if (!order) throw new BadRequestError('Order not found');

		let isSubOrder = false;
		const newDeliveriesArray = order.deliveries.map((deli) => {
			deli = JSON.parse(JSON.stringify(deli));

			if (deli._id == subOrder) {
				if (deli.productionEstimationDate)
					throw new BadRequestError('Already set');
				isSubOrder = true;

				return {
					...deli,
					status: OrderStatus.PRODUCTION_PENDING,
					productionEstimationDate: date,
				};
			}

			return deli;
		});

		if (!isSubOrder) throw new BadRequestError('suborder not found');

		const data = await OrderRepo.update({
			_id: foundInquiry.order,
			deliveries: newDeliveriesArray,
			stage: 'PRODUCTION_PENDING',
		} as Order);

		orderEvent.onProductionSetDate(order._id, subOrder);

		return new SuccessResponse(
			'success',
			_.pick(data, ['_id', 'prodType', 'treatmentPlanner']),
		).send(res);
	}),
);

// router.put(
// 	'/assign/delivery',
// 	authentication,
// 	role(RoleCode.PRODUCTION_MANAGER),
// 	authorization,
// 	validator(schema.assignDelivery, ValidationSource.BODY),
// 	asyncHandler(async (req: ProtectedRequest, res) => {
// 		const { inquiry, subOrder, aligners } = req.body;

// 		const foundInquiry = await InquiryRepo.findFieldsById(
// 			inquiry,
// 			'impressionStatus',
// 			'quoteStatus',
// 			'lab',
// 			'order',
// 			'patient',
// 		);

// 		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

// 		if (!foundInquiry.order) throw new BadRequestError('Order not found');

// 		const order = await OrderRepo.findFieldsById(
// 			foundInquiry.order! as Types.ObjectId,
// 			'deliveries',
// 			'quoteDetails',
// 		);

// 		if (!order) throw new BadRequestError('Order not found');

// 		let isSubOrder = false;
// 		let alignersLeft = order.quoteDetails.totalAligners;

// 		const newDeliveriesArray = order.deliveries.map((deli) => {
// 			deli = JSON.parse(JSON.stringify(deli));

// 			if (deli._id == subOrder) {
// 				if (deli.status !== OrderStatus.PRODUCTION_PENDING)
// 					throw new BadRequestError('Something went wrong.');
// 				isSubOrder = true;
// 				alignersLeft -= aligners;

// 				return {
// 					...deli,
// 					totalAligners: aligners,
// 					status: OrderStatus.DELIVERY_PENDING,
// 				};
// 			}

// 			alignersLeft -= deli.totalAligners;
// 			return deli;
// 		});

// 		if (alignersLeft > 0) {
// 			newDeliveriesArray.push({
// 				_id: new Types.ObjectId(),
// 				prodType: ProductType.ALIGNER,
// 				dentist: foundInquiry.dentist,
// 				productionManager: null,
// 				deliveryCoordinator: null,
// 				productionEstimationDate: null,
// 				totalAligners: alignersLeft,
// 				status: OrderStatus.PENDING,
// 				deliveryDetails: {
// 					deliveryType: DeliveryType.SELF,
// 					trackingId: undefined,
// 				},
// 			});
// 		}

// 		if (!isSubOrder) throw new BadRequestError('suborder not found');

// 		const data = await OrderRepo.update({
// 			_id: foundInquiry.order,
// 			deliveries: newDeliveriesArray,
// 		} as Order);

// 		const foundUsers = await UserRepo.getAllLabDeliveryCoordinators(
// 			extractObjectId(foundInquiry.lab),
// 		);

// 		await ChatRoomRepo.addUsersToRoom(foundInquiry.patient.toString(), [
// 			...foundUsers.map((usr) => usr._id),
// 		]);

// 		await ChatRoomRepo.addUsersToRoom(`lab${foundInquiry.patient.toString()}`, [
// 			...foundUsers.map((usr) => usr._id),
// 		]);

// 		orderEvent.onAssignDelivery(order._id, subOrder);

// 		return new SuccessResponse(
// 			'success',
// 			_.pick(data, ['_id', 'prodType', 'treatmentPlanner']),
// 		).send(res);
// 	}),
// );

router.put(
	'/ship',
	authentication,
	role(RoleCode.PRODUCTION_MANAGER, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.shipProduct, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry, subOrder, aligners, deliveryMethod, trackingId } =
			req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'dentist',
			'impressionStatus',
			'quoteStatus',
			'lab',
			'order',
			'patient',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

		if (!foundInquiry.order) throw new BadRequestError('Order not found');

		const foundOrder = await OrderRepo.findFieldsById(
			foundInquiry.order! as Types.ObjectId,
			'deliveries',
			'quoteDetails',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		let isSubOrder = false;
		let alignersLeft = foundOrder.quoteDetails.totalAligners;

		const newDeliveriesArray = foundOrder.deliveries.map((deli) => {
			deli = JSON.parse(JSON.stringify(deli));

			if (deli._id == subOrder) {
				if (deli.status == OrderStatus.IN_SHIPMENT)
					throw new BadRequestError('Impression is already in shipment');
				if (deli.status !== OrderStatus.PRODUCTION_PENDING)
					throw new BadRequestError('Something went wrong.');
				isSubOrder = true;
				alignersLeft -= aligners;

				return {
					...deli,
					totalAligners: aligners,
					status: OrderStatus.IN_SHIPMENT,
					deliveryDetails: {
						deliveryType: deliveryMethod,
						trackingId: trackingId ?? null,
					},
				};
			}

			alignersLeft -= deli.totalAligners;
			return deli;
		});

		if (alignersLeft > 0) {
			newDeliveriesArray.push({
				_id: new Types.ObjectId(),
				prodType: ProductType.ALIGNER,
				dentist: foundInquiry.dentist,
				productionManager: null,
				deliveryCoordinator: null,
				productionEstimationDate: null,
				totalAligners: alignersLeft,
				status: OrderStatus.PENDING,
				deliveryDetails: {
					deliveryType: DeliveryType.SELF,
					trackingId: undefined,
				},
			});
		}

		if (!isSubOrder) throw new BadRequestError('suborder not found');

		const data = await OrderRepo.update({
			_id: foundInquiry.order,
			deliveries: newDeliveriesArray,
			stage: 'IN_SHIPMENT',
		} as Order);

		orderEvent.onOrderShip(foundOrder._id, subOrder);

		return new SuccessResponse(
			'success',
			_.pick(data, ['_id', 'prodType', 'treatmentPlanner']),
		).send(res);
	}),
);

router.put(
	'/selfassign/production',
	authentication,
	role(RoleCode.PRODUCTION_MANAGER, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.selfAssignProductionManager, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry, subOrder } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'impressionStatus',
			'quoteStatus',
			'patient',
			'order',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

		if (!foundInquiry.order) throw new BadRequestError('Order not found');

		const order = await OrderRepo.findFieldsById(
			extractObjectId(foundInquiry.order),
			'deliveries',
		);

		if (!order) throw new BadRequestError('Order not found');

		let isSubOrder = false;

		const newDeliveriesArray = order.deliveries.map((deli) => {
			deli = JSON.parse(JSON.stringify(deli));

			if (deli._id == subOrder) {
				if (deli.productionManager)
					throw new BadRequestError('Already assigned');
				isSubOrder = true;

				return {
					...deli,
					productionManager: req.user._id,
				};
			}

			return deli;
		});

		if (!isSubOrder) throw new BadRequestError('suborder not found');

		const data = await OrderRepo.update({
			_id: foundInquiry.order,
			deliveries: newDeliveriesArray,
			stage: 'PRODUCTION_ASSIGNED',
			productionId: req.user._id,
		} as Order);

		await ChatRoomRepo.addUsersToRoom(foundInquiry.patient.toString(), [
			req.user._id,
		]);

		await ChatRoomRepo.addUsersToRoom(`lab${foundInquiry.patient.toString()}`, [
			req.user._id,
		]);

		return new SuccessResponse(
			'success',
			_.pick(data, ['_id', 'prodType', 'treatmentPlanner']),
		).send(res);
	}),
);
router.get(
	'/report',
	role(RoleCode.LAB_ADMIN),
	validator(schema.report, ValidationSource.QUERY),
	authorization,
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			startDate = new Date(),
			endDate = new Date(),
			clinicId,
		} = req.query;
		const data = await OrderRepo.getAllOrders(
			startDate as Date,
			endDate as Date,
			clinicId as string,
		);

		new SuccessResponse('Success', {
			percentageChange: data[0],
			ordersPerDate: data[1],
			count: data[2],
		}).send(res);
	}),
);

router.get(
	'/:id',
	authentication,
	role(RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundOrder = await OrderRepo.findDetailById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		const foundClinic = await ClinicRepo.findFieldsById(
			extractObjectId(foundOrder.clinic),
			'pricingPlan',
		);

		foundOrder.clinic = foundClinic ?? foundOrder.clinic;

		new SuccessResponse('success', foundOrder).send(res);
	}),
);

router.get(
	'/clinic/:id',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN),
	authorization,
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { page = 1, limit = 1, searchQuery = '' } = req.query;

		const foundClinic = await ClinicRepo.findFieldsById(
			new Types.ObjectId(req.params.id),
			'_id',
			'pricingPlan',
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const orders = await OrderRepo.getOrdersByClinic(
			extractObjectId(req.user.lab),
			new Types.ObjectId(req.params.id),
			+page,
			+limit,
			(searchQuery as string) || '',
		);

		const cachedExchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
		);

		let currency = 0;

		if (cachedExchangeRates) {
			const value = cachedExchangeRates[foundClinic.pricingPlan.currency];

			currency = Number(value);
		}

		orders[0].forEach((order) => {
			order.quoteDetails.price = order.quoteDetails.price * currency;
		});

		new SuccessResponse('Orders fetched successfully', {
			data: orders[0],
			count: orders[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.get(
	'/my/deliveryOrders',
	role(RoleCode.LAB_ADMIN, RoleCode.DELIVERY_COORDINATOR),
	authorization,
	validator(schema.getAll, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			searchQuery = '',
			page = 1,
			limit = 10,
			filter,
			deliveryCoordinator,
		} = req.query;

		const role = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

		if (!role) throw new BadRequestError('Role not found');

		const isLabAdmin = req.user.role._id.equals(role._id);

		if (isLabAdmin && !deliveryCoordinator) {
			throw new BadRequestError('Delivery Coordinator is required');
		}

		const userId = isLabAdmin ? deliveryCoordinator : req.user._id;

		const data = await OrderRepo.getAllOrdersAssignedToDeliveryCoordinator(
			searchQuery as string,
			filter as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			userId as Types.ObjectId,
		);

		new SuccessResponse('Success', {
			orders: data[0],
			count: data[1][0]?.count ?? 0,
		}).send(res);
	}),
);

router.put(
	'/:id/delete',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req, res) => {
		const foundOrder = await OrderRepo.findFieldsById(
			new Types.ObjectId(req.params.id),
			'isDeleted',
			'quoteDetails',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		if (foundOrder.isDeleted) {
			throw new BadRequestError('Order already deleted');
		}

		const updatedOrder = await OrderRepo.updateById(foundOrder._id, {
			isDeleted: true,
		} as Order);

		if (!updatedOrder) throw new BadRequestError('Order not updated');

		if (foundOrder.quoteDetails.status === QuoteStatus.DENTIST_APPROVED) {
			const foundClinic = await ClinicRepo.findFieldsById(
				extractObjectId(foundOrder.clinic),
				'dueAmount',
			);

			if (!foundClinic) {
				await OrderRepo.updateById(foundOrder._id, {
					isDeleted: false,
				} as Order);

				throw new BadRequestError('Clinic not found');
			}

			const deductDueAmount =
				foundClinic.dueAmount - foundOrder.quoteDetails.price;

			await ClinicRepo.update({
				_id: foundOrder.clinic,
				dueAmount: deductDueAmount,
			} as Clinic);
		}

		new SuccessResponse('Order deleted succesfully', {}).send(res);
	}),
);

router.put(
	'/:id/undo',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req, res) => {
		const foundOrder = await OrderRepo.findFieldsById(
			new Types.ObjectId(req.params.id),
			'isDeleted',
			'quoteDetails',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		if (!foundOrder.isDeleted) {
			throw new BadRequestError('Order not deleted');
		}

		const updatedOrder = await OrderRepo.updateById(foundOrder._id, {
			isDeleted: false,
		} as Order);

		if (!updatedOrder) throw new BadRequestError('Failed to undo delete.');

		if (foundOrder.quoteDetails.status === QuoteStatus.DENTIST_APPROVED) {
			const foundClinic = await ClinicRepo.findFieldsById(
				extractObjectId(foundOrder.clinic),
				'dueAmount',
			);

			if (!foundClinic) {
				await OrderRepo.updateById(foundOrder._id, {
					isDeleted: true,
				} as Order);

				throw new BadRequestError('Clinic not found');
			}

			const deductDueAmount =
				foundClinic.dueAmount + foundOrder.quoteDetails.price;

			await ClinicRepo.update({
				_id: foundOrder.clinic,
				dueAmount: deductDueAmount,
			} as Clinic);
		}
		new SuccessResponse('Order retrieved succesfully', {}).send(res);
	}),
);

export default router;
