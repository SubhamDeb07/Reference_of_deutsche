import Order, { OrderModel, OrderStatus, QuoteStatus } from './model';
import { Types } from 'mongoose';
import InquiryRepo from '../Inquiry/repo';
import ClinicRepo from '../Clinic/repo';
import UserRepo from '../User/repo';
import Inquiry from '../Inquiry/model';
import RoleRepo from '../Role/repo';
import _ from 'lodash';
import { BadRequestError } from '../../core/ApiError';
import { RoleCode } from '../Role/model';

async function findById(id: Types.ObjectId): Promise<Order | null> {
	return OrderModel.findOne({ _id: id }).lean().exec();
}

async function findDetailById(id: Types.ObjectId): Promise<Order | null> {
	return OrderModel.findOne({ _id: id })
		.select(
			'inquiry patient dentist quoteDetails quoteHistory deliveries createdAt',
		)
		.populate({ path: 'inquiry', select: 'archSide treatmentDetails' })
		.populate({
			path: 'patient dentist clinic',
			select:
				'_id name userId dob gender phoneNumber countryCode profilePicUrl',
		})
		.populate({
			path: 'deliveries.productionManager deliveries.deliveryCoordinator',
			select: '_id name userId',
		});
}

async function getPatientOrders(
	patient: Types.ObjectId,
): Promise<Order[] | []> {
	return OrderModel.find({ patient });
}

async function create(
	order: Order,
	createdBy: Types.ObjectId,
	adminId: Types.ObjectId | null,
): Promise<Order> {
	const now = new Date();
	order.quoteDetails.status = QuoteStatus.PENDING_APPROVAL;
	order.createdAt = now;
	order.updatedAt = now;

	if (adminId) {
		order.quoteDetails.status = QuoteStatus.ADMIN_APPROVED;
	}

	const createdOrder = await OrderModel.create(order);
	await InquiryRepo.update({
		_id: order.inquiry,
		order: createdOrder._id,
		quoteStatus: createdOrder.quoteDetails.status,
	} as Inquiry);
	return createdOrder.toObject();
}

async function reviewOrdersWithSearchPaginated(
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId,
): Promise<[Order[], number]> {
	const findObj: any = {
		lab: labId,
		clinic: clinicId,
		isDeleted: false,
		'quoteDetails.status': QuoteStatus.DENTIST_REVIEWED,
		$or: [],
	};

	if (searchQuery) {
		const userIds = await UserRepo.search(searchQuery, 50, labId, [clinicId]);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], 0];
		}
	}

	return Promise.all([
		OrderModel.find(findObj)
			.select('_id inquiry patient dentist quoteDetails createdAt')
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'inquiry patient dentist',
				select: '_id name userId profilePicUrl prodType',
			})
			.lean()
			.exec(),
		OrderModel.countDocuments(findObj),
	]);
}

async function getClinicOrdersWithSearchFilterPaginated(
	searchQuery: string,
	filter: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId,
	dentistId: Types.ObjectId | null,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		clinic: clinicId,
		isDeleted: false,
		lab: labId,
		$or: [],
	};

	if (dentistId) findObj.dentist = dentistId;

	let deliveriesFilter: any = {};

	// 'ALL', 'MANUFACTURING', 'SHIPPED', 'DELIVERED', 'CANCELED';
	switch (filter) {
		case 'MANUFACTURING':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.PRODUCTION_PENDING,
				'deliveries.productionEstimationDate': { $ne: null },
				'deliveries.productionManager': { $ne: null },
			};
			break;
		case 'SHIPPED':
			deliveriesFilter = {
				'deliveries.status': {
					$in: [OrderStatus.IN_SHIPMENT, OrderStatus.DELIVERY_PENDING],
				},
			};
			break;
		case 'DELIVERED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DELIVERED,
			};
			break;
		case 'CANCELED':
			findObj['quoteDetails.status'] = QuoteStatus.DENTIST_CANCELED;
			break;
		case 'ALL':
			deliveriesFilter = {
				'deliveries.status': { $ne: OrderStatus.PENDING },
			};
			break;
		default:
			throw new BadRequestError('status not defined');
	}

	if (searchQuery) {
		const userIds = await UserRepo.search(searchQuery, 50, labId, [clinicId]);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], [{ count: 0 }]];
		}
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'clinics',
					let: { clinicId: '$clinic' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$clinicId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'clinic',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { productionUserId: '$deliveries.productionManager' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$productionUserId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveries.productionManager',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { inquiryId: '$inquiry' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$inquiryId'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
								impressionStatus: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$project: {
					_id: 1,
					inquiry: { $first: '$inquiry' },
					lab: 1,
					clinic: { $first: '$clinic' },
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					quoteDetails: 1,
					orderDetails: '$deliveries',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{
				$group: {
					_id: null,
					count: {
						$sum: 1,
					},
				},
			},
		]),
	]);
}

async function getAllOrdersWithSearchFilterPaginated(
	searchQuery: string,
	filter: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	sortField: string = 'deliveries.productionEstimationDate',
	sortOrder: string = 'desc',
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
	};

	let deliveriesFilter: any = {
		isDeleted: false,
	};

	switch (filter) {
		case 'NEW':
			findObj['quoteDetails.status'] = QuoteStatus.DENTIST_APPROVED;
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DENTIST_APPROVED,
				'deliveries.productionEstimationDate': { $eq: null },
				'deliveries.productionManager': { $eq: null },
			};
			break;
		case 'IN_PROGRESS':
			deliveriesFilter = {
				'deliveries.status': {
					$in: [
						OrderStatus.DENTIST_APPROVED,
						OrderStatus.PRODUCTION_PENDING,
						OrderStatus.DELIVERY_PENDING,
					],
				},
				'deliveries.productionManager': { $ne: null },
			};
			break;
		case 'SHIPPED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.IN_SHIPMENT,
			};
			break;
		case 'DELIVERED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DELIVERED,
			};
			break;
		case 'ALL':
			deliveriesFilter = {
				'deliveries.status': {
					$nin: [OrderStatus.PENDING],
				},
			};
			break;
		default:
			throw new BadRequestError('status not defined');
	}

	switch (sortField) {
		case 'productionEstimationDate':
			sortField = 'deliveries.productionEstimationDate';
			break;
		case 'quoteStatus':
			sortField = 'deliveries.status';
			break;
	}

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (!_.isEmpty(clinicIds)) {
			findObj.$or.push({
				clinic: {
					$in: clinicIds,
				},
			});
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], [{ count: 0 }]];
		}
	}

	const sortObj: { [key: string]: 1 | -1 } = {};
	sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},

			{
				$match: deliveriesFilter,
			},
			{
				$sort: sortObj,
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'clinics',
					let: { clinicId: '$clinic' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$clinicId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'clinic',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { productionUserId: '$deliveries.productionManager' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$productionUserId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveries.productionManager',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { inquiryId: '$inquiry' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$inquiryId'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
								impressionStatus: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$project: {
					_id: 1,
					createdAt: 1,
					inquiry: { $first: '$inquiry' },
					lab: 1,
					clinic: { $first: '$clinic' },
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					quoteDetails: 1,
					orderDetails: '$deliveries',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{
				$group: {
					_id: null,
					count: {
						$sum: 1,
					},
				},
			},
		]),
	]);
}

async function getMyProductionOrdersWithSearchFilterPaginated(
	searchQuery: string,
	filter: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	userId: Types.ObjectId,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
	};

	let deliveriesFilter: any = {};

	switch (filter) {
		case 'NEW':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DENTIST_APPROVED,
				'deliveries.productionEstimationDate': { $eq: null },
				'deliveries.productionManager': new Types.ObjectId(userId),
			};
			break;
		case 'IN_PROGRESS':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.PRODUCTION_PENDING,
				'deliveries.productionEstimationDate': { $ne: null },
				'deliveries.productionManager': new Types.ObjectId(userId),
			};
			break;
		case 'SHIPPED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.IN_SHIPMENT,
				'deliveries.productionEstimationDate': { $ne: null },
				'deliveries.productionManager': new Types.ObjectId(userId),
			};
			break;
		case 'COMPLETED':
			deliveriesFilter = {
				'deliveries.status': {
					$nin: [
						OrderStatus.PENDING,
						OrderStatus.DENTIST_APPROVED,
						OrderStatus.PRODUCTION_PENDING,
					],
				},
				'deliveries.productionManager': new Types.ObjectId(userId),
			};
			break;
		default:
			throw new BadRequestError('status not defined');
	}

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (!_.isEmpty(clinicIds)) {
			findObj.$or.push({
				clinic: {
					$in: clinicIds,
				},
			});
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], [{ count: 0 }]];
		}
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'clinics',
					let: { clinicId: '$clinic' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$clinicId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'clinic',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { productionUserId: '$deliveries.productionManager' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$productionUserId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveries.productionManager',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { inquiryId: '$inquiry' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$inquiryId'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
								impressionStatus: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$project: {
					_id: 1,
					inquiry: { $first: '$inquiry' },
					lab: 1,
					clinic: { $first: '$clinic' },
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					quoteDetails: 1,
					orderDetails: '$deliveries',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{
				$group: {
					_id: 1,
					count: {
						$sum: 1,
					},
				},
			},
		]),
	]);
}

async function findFieldsById(
	id: Types.ObjectId,
	...fields: string[]
): Promise<Order | null> {
	return OrderModel.findOne({ _id: id }, [...fields])
		.lean()
		.exec();
}

async function update(order: Order): Promise<any> {
	order.updatedAt = new Date();
	return OrderModel.updateOne({ _id: order._id }, { $set: { ...order } })
		.lean()
		.exec();
}

async function deleteById(id: Types.ObjectId): Promise<any> {
	return OrderModel.deleteOne({ _id: id }).lean().exec();
}

async function getAllOrdersAssignedToDeliveryCoordinator(
	searchQuery: string,
	filter: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	userId: Types.ObjectId,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
	};

	let deliveriesFilter: any = {};

	switch (filter) {
		case 'NEW':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DENTIST_APPROVED,
				'deliveries.productionEstimationDate': { $eq: null },
				'deliveries.productionManager': { $eq: null },
				'deliveries.deliveryCoordinator': new Types.ObjectId(userId),
			};
			break;
		case 'IN_PROGRESS':
			deliveriesFilter = {
				'deliveries.status': {
					$in: [
						OrderStatus.DENTIST_APPROVED,
						OrderStatus.PRODUCTION_PENDING,
						OrderStatus.DELIVERY_PENDING,
					],
				},
				'deliveries.productionEstimationD.DELIVERY_PENDINGate': { $ne: null },
				'deliveries.productionManager': { $ne: null },
				'deliveries.deliveryCoordinator': new Types.ObjectId(userId),
			};
			break;
		case 'SHIPPED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.IN_SHIPMENT,
				'deliveries.deliveryCoordinator': new Types.ObjectId(userId),
			};
			break;
		case 'DELIVERED':
			deliveriesFilter = {
				'deliveries.status': OrderStatus.DELIVERED,
				'deliveries.deliveryCoordinator': new Types.ObjectId(userId),
			};
			break;
		case 'ALL':
			deliveriesFilter = {
				'deliveries.status': {
					$nin: [OrderStatus.PENDING],
				},
				'deliveries.deliveryCoordinator': new Types.ObjectId(userId),
			};
			break;
		default:
			throw new BadRequestError('status not defined');
	}

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (!_.isEmpty(clinicIds)) {
			findObj.$or.push({
				clinic: {
					$in: clinicIds,
				},
			});
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], [{ count: 0 }]];
		}
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'clinics',
					let: { clinicId: '$clinic' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$clinicId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'clinic',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { productionUserId: '$deliveries.productionManager' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$productionUserId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveries.productionManager',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { inquiryId: '$inquiry' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$inquiryId'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
								impressionStatus: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { deliveryCoordinatorId: '$deliveries.deliveryCoordinator' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$deliveryCoordinatorId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveryCoordinator',
				},
			},
			{
				$project: {
					_id: 1,
					createdAt: 1,
					inquiry: { $first: '$inquiry' },
					lab: 1,
					clinic: { $first: '$clinic' },
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					deliveryCoordinator: { $first: '$deliveryCoordinator' },
					quoteDetails: 1,
					orderDetails: '$deliveries',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$match: deliveriesFilter,
			},
			{
				$group: {
					_id: null,
					count: {
						$sum: 1,
					},
				},
			},
		]),
	]);
}

async function getOrdersByClinic(
	id: Types.ObjectId,
	clinicId: Types.ObjectId,
	pageNumber: number,
	limit: number,
	searchQuery: string,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		clinic: clinicId,
		isDeleted: false,
		lab: id,
	};

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (_.isEmpty(clinicIds)) {
			return [[], [{ count: 0 }]];
		}

		findObj.clinic = {
			$in: clinicIds,
		};
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$skip: limit * (pageNumber - 1),
			},
			{
				$limit: limit,
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { orderId: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$$orderId', '$order'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$group: {
					_id: null,
					count: {
						$sum: 1,
					},
				},
			},
		]).exec(),
	]);
}

function generateDateRange(startDate: Date, endDate: Date) {
	const dates = [];
	const currentDate = new Date(startDate.toISOString().split('T')[0]);
	while (currentDate <= endDate) {
		dates.push(new Date(currentDate));
		currentDate.setDate(currentDate.getDate() + 1);
	}
	return dates;
}

async function getAllOrders(
	startDate: Date,
	endDate: Date,
	clinicId: string,
): Promise<[number, { date: string; count: number }[], number]> {
	const start = new Date(startDate);
	start.setHours(0, 0, 0, 0);

	const end = new Date(endDate);
	end.setHours(23, 59, 59, 999);
	let presentPeriodcount = 0;

	const periodDuration = end.getTime() - start.getTime();

	const previousPeriodStart = new Date(start.getTime() - periodDuration);

	const previousPeriodEnd = new Date(start);
	previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

	const previousPeriodCount = await OrderModel.countDocuments({
		approvedDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
		clinic: new Types.ObjectId(clinicId),
	});

	const ordersGroupedByDay = await OrderModel.aggregate([
		{
			$match: {
				approvedDate: { $gte: start, $lte: end },
				isDeleted: false,
				clinic: new Types.ObjectId(clinicId),
			},
		},
		{
			$group: {
				_id: {
					day: { $dayOfMonth: '$approvedDate' },
					month: { $month: '$approvedDate' },
					year: { $year: '$approvedDate' },
				},
				count: { $sum: 1 },
			},
		},
		{
			$sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
		},
	]);

	const allDates = generateDateRange(start, end);

	const ordersMap: { [key: string]: number } = {};
	ordersGroupedByDay.forEach((order) => {
		const dateString = `${order._id.year}-${String(order._id.month).padStart(
			2,
			'0',
		)}-${String(order._id.day).padStart(2, '0')}`;
		ordersMap[dateString] = order.count;
	});

	const dailyCounts = allDates.map((date) => {
		const dateString = date.toISOString().split('T')[0];
		return {
			date: dateString,
			count: ordersMap[dateString] || 0,
		};
	});

	presentPeriodcount += dailyCounts.reduce((a, b) => a + b.count, 0);

	let percentageChange = 0;
	if (previousPeriodCount === 0) {
		percentageChange = presentPeriodcount * 100;
	} else if (previousPeriodCount > 0) {
		percentageChange =
			((presentPeriodcount - previousPeriodCount) / previousPeriodCount) * 100;
	}

	return [percentageChange, dailyCounts, presentPeriodcount];
}

async function findPresentationDetails(id: string): Promise<Order | null> {
	return OrderModel.findOne({ 'quoteDetails.presentationFolder': id })
		.select('inquiry patient dentist quoteDetails quoteHistory deliveries')
		.populate({ path: 'inquiry', select: 'archSide treatmentDetails' })
		.populate({
			path: 'patient dentist',
			select: '_id name userId dob gender',
		})
		.populate({
			path: 'deliveries.productionManager deliveries.deliveryCoordinator',
			select: '_id name userId',
		});
}

async function getOrdersOfClinic(
	clinicId: Types.ObjectId,
	dentistId: Types.ObjectId,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	filter: string,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		clinic: new Types.ObjectId(clinicId),
		isDeleted: false,
		$or: [],
	};

	if (dentistId) findObj.dentist = new Types.ObjectId(dentistId);

	if (searchQuery) {
		const nextQuery =
			searchQuery.slice(0, -1) +
			String.fromCharCode(searchQuery.charCodeAt(searchQuery.length - 1) + 1);

		const userSearchQuery = {
			$or: [
				{ name: { $gte: searchQuery, $lt: nextQuery } },
				{ email: { $gte: searchQuery, $lt: nextQuery } },
				{ userId: { $gte: searchQuery, $lt: nextQuery } },
			],
			clinic: clinicId,
		};
		const userIds = await UserRepo.findByFieldsWithPagination(
			userSearchQuery,
			1,
			50,
		);

		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;
		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], [{ count: 0 }]]);
		}
	}

	// 'ALL', 'ONGOING', 'COMPLETED', 'CANCELED';
	switch (filter) {
		case 'ONGOING':
			findObj['deliveries'] = {
				$not: {
					$elemMatch: {
						status: { $eq: 'DELIVERED' },
					},
				},
			};
			break;
		case 'COMPLETED':
			findObj['deliveries'] = {
				$not: {
					$elemMatch: {
						status: { $ne: 'DELIVERED' },
					},
				},
			};
			break;
		case 'CANCELED':
			findObj['quoteDetails.status'] = QuoteStatus.DENTIST_CANCELED;
			break;
		case 'ALL':
			break;
		default:
			throw new BadRequestError('status not defined');
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { orderId: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$order', '$$orderId'] },
							},
						},
						{
							$project: {
								_id: 1,
								createdAt: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$project: {
					_id: 1,
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					inquiry: { $first: '$inquiry' },
					quoteDetails: 1,
					deliveries: 1,
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$group: {
					_id: null,
					count: { $sum: 1 },
				},
			},
		]),
	]);
}

async function updateById(id: Types.ObjectId, order: Order): Promise<any> {
	order.updatedAt = new Date();
	return OrderModel.updateOne({ _id: id }, { $set: { ...order } })
		.lean()
		.exec();
}

async function getDeletedOrders(
	searchQuery: string,
	labId: Types.ObjectId,
	pageNumber: number,
	limit: number,
): Promise<[Order[], { count: number }[]]> {
	const findObj: any = {
		isDeleted: true,
		$or: [],
	};

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (!_.isEmpty(clinicIds)) {
			findObj.$or.push({
				clinic: {
					$in: clinicIds,
				},
			});
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return [[], [{ count: 0 }]];
		}
	}

	return Promise.all([
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{ $skip: limit * (pageNumber - 1) },
			{ $limit: limit },
			{
				$lookup: {
					from: 'clinics',
					let: { clinicId: '$clinic' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$clinicId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'clinic',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { productionUserId: '$deliveries.productionManager' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$productionUserId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'deliveries.productionManager',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { inquiryId: '$inquiry' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$inquiryId'] },
							},
						},
						{
							$project: {
								_id: 1,
								prodType: 1,
								impressionStatus: 1,
							},
						},
					],
					as: 'inquiry',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { patientId: '$patient' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$patientId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'patient',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { dentistId: '$dentist' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$_id', '$$dentistId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
								userId: 1,
								profilePicUrl: 1,
							},
						},
					],
					as: 'dentist',
				},
			},
			{
				$project: {
					_id: 1,
					createdAt: 1,
					updateAt: 1,
					isDeleted: 1,
					inquiry: { $first: '$inquiry' },
					lab: 1,
					clinic: { $first: '$clinic' },
					patient: { $first: '$patient' },
					dentist: { $first: '$dentist' },
					quoteDetails: 1,
					orderDetails: '$deliveries',
				},
			},
		]),
		OrderModel.aggregate([
			{
				$match: findObj,
			},
			{
				$unwind: '$deliveries',
			},
			{
				$group: {
					_id: null,
					count: {
						$sum: 1,
					},
				},
			},
		]),
	]);
}

export default {
	getPatientOrders,
	findById,
	findDetailById,
	reviewOrdersWithSearchPaginated,
	getAllOrdersWithSearchFilterPaginated,
	getClinicOrdersWithSearchFilterPaginated,
	getMyProductionOrdersWithSearchFilterPaginated,
	deleteById,
	create,
	findFieldsById,
	update,
	getAllOrdersAssignedToDeliveryCoordinator,
	getOrdersByClinic,
	getAllOrders,
	findPresentationDetails,
	getOrdersOfClinic,
	updateById,
	getDeletedOrders,
};
