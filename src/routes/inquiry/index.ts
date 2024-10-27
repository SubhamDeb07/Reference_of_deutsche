import express from 'express';
import { Types } from 'mongoose';
import { ProtectedRequest } from 'app-request';
import _ from 'lodash';
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
import InquiryRepo from '../../database/Inquiry/repo';
import OrderRepo from '../../database/Order/repo';
import UserRepo from '../../database/User/repo';
import ClinicRepo from '../../database/Clinic/repo';
import LabRepo from '../../database/Lab/repo';
import ChatRoomRepo from '../../database/ChatRoom/repo';
import RoleRepo from '../../database/Role/repo';
import { ApprovalStatus } from '../../database/User/model';
import Inquiry, { ImpressionStatus } from '../../database/Inquiry/model';
import { ProductType } from '../../database/Inquiry/types';
import Order, {
	DeliveryType,
	OrderStatus,
	QuoteStatus,
} from '../../database/Order/model';
import ChatRoom from '../../database/ChatRoom/model';
import { inquiryEvent } from '../../events';
import { getJson } from '../../cache/query';
import { DynamicKey, getDynamicKey } from '../../cache/keys';
import { Currency } from '../../database/Clinic/model';

const router = express.Router();

router.use(authentication);

router.get(
	'/clinic',
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.treatmentPlans, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { filter, page = 1, limit = 10 } = req.query;

		const adminRole = await RoleRepo.findByCode(RoleCode.DENTIST);

		const foundInquiries = await InquiryRepo.treatmentPlans(
			req.user.clinic as Types.ObjectId,
			adminRole && req.user.role._id.toString() === adminRole._id.toString()
				? req.user._id
				: null,
			filter as string,
			+page,
			+limit,
		);

		new SuccessResponse('Success', {
			data: foundInquiries[0],
			count: foundInquiries[1],
		}).send(res);
	}),
);

router.post(
	'/',
	authentication,
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.createInquiry, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		let isNewPatient = false;
		let createdPatient = null;

		if (!req.body.patientId) {
			req.body.patient.approvalStatus = ApprovalStatus.APPROVED;
			req.body.patient.isPermissionAdded = true;
			req.body.patient.dentist = req.user._id;

			if (req.body.patient.email) {
				const patientRole = await RoleRepo.findByCode(RoleCode.PATIENT);

				if (!patientRole) throw new BadRequestError('Role not found');

				const foundDuplicateUser = await UserRepo.findByFields({
					email: req.body.patient.email,
					role: {
						$ne: extractObjectId(patientRole._id),
					},
				});

				if (foundDuplicateUser)
					throw new BadRequestError('This email is already in use');
			}

			createdPatient = await UserRepo.create(
				req.body.patient,
				RoleCode.PATIENT,
				extractObjectId(req.user.lab),
				extractObjectId(req.user.clinic as Types.ObjectId),
			);
			isNewPatient = true;
		}

		req.body.order.patient = req.body.patientId ?? createdPatient?.user._id;

		const prodType: ProductType = req.body.order.prodType;

		let foundAligner = null;
		let foundOrder = null;
		if (prodType !== ProductType.ALIGNER) {
			foundAligner = await InquiryRepo.getByPatientAndProdType(
				req.body.order.patient,
				ProductType.ALIGNER,
			);

			if (!foundAligner) throw new BadRequestError('Aligner not created');

			foundOrder = await OrderRepo.findFieldsById(
				foundAligner.order as Types.ObjectId,
				'deliveries',
				'quoteDetails',
			);

			if (!foundOrder) throw new BadRequestError('Quotes are yet to be added');

			req.body.order.archSide = foundAligner.archSide;
			req.body.order.order = foundOrder._id;
			req.body.order.quoteStatus = foundOrder.quoteDetails.status;
			req.body.order.treatmentPlanner = foundAligner.treatmentPlanner;
			req.body.order.quoteEstimationDate = foundAligner.quoteEstimationDate;

			if (prodType === ProductType.RETAINER) {
				req.body.order.treatmentDetails = foundAligner.treatmentDetails;
			}
		}

		let createdInquiry = null;

		try {
			if (!req.user.clinic) throw new BadRequestError('Clinic is required');

			createdInquiry = await InquiryRepo.create(
				req.body.order,
				extractObjectId(req.user.lab),
				extractObjectId(req.user.clinic),
				req.user._id,
			);

			if (!createdInquiry) {
				if (isNewPatient && createdPatient)
					await UserRepo.deleteById(createdPatient.user._id);

				throw new BadRequestError('Unable to create Inquiry');
			}

			if (req.body.order.prodType !== ProductType.ALIGNER) {
				if (!foundOrder)
					throw new BadRequestError('Quotes are yet to be added');

				const newDeliveriesArray = foundOrder.deliveries;

				newDeliveriesArray.push({
					_id: new Types.ObjectId(),
					prodType: req.body.order.prodType,
					dentist: req.user._id,
					productionManager: null,
					productionEstimationDate: null,
					deliveryCoordinator: null,
					totalAligners: foundOrder.quoteDetails.totalAligners,
					status: OrderStatus.DENTIST_APPROVED,
					deliveryDetails: {
						deliveryType: DeliveryType.SELF,
					},
				});

				await OrderRepo.update({
					_id: foundOrder._id,
					deliveries: newDeliveriesArray,
				} as Order);
			}
		} catch (error) {
			if (isNewPatient && createdPatient)
				await UserRepo.deleteById(createdPatient.user._id);

			throw error;
		}

		if (req.body.order.prodType === ProductType.ALIGNER) {
			const dentistAdmins = await UserRepo.getAllDentistAdmins(
				extractObjectId(req.user.lab),
				extractObjectId(req.user.clinic),
			);

			const labAdmins = await UserRepo.getAllLabAdmins(
				extractObjectId(req.user.lab),
			);

			const labAdminIds = labAdmins.map((x) => x._id.toString());
			const dentistAdminIds = dentistAdmins.map((x) => x._id.toString());

			const roomUsers: Types.ObjectId[] = [
				...new Set([
					...labAdminIds,
					...dentistAdminIds,
					req.user._id.toString(),
				]),
			].map((x) => new Types.ObjectId(x));

			await ChatRoomRepo.create({
				users: roomUsers,
				roomId: createdInquiry.patient.toString(),
			} as ChatRoom);

			await ChatRoomRepo.create({
				users: labAdmins.map((x) => x._id),
				roomId: `lab${createdInquiry.patient.toString()}`,
			} as ChatRoom);
		}

		inquiryEvent.onInquiryCreated(createdInquiry._id);

		new SuccessResponse(
			'Success',
			_.pick(createdInquiry, ['_id', 'prodType', 'status', 'dentist']),
		).send(res);
	}),
);

router.get(
	'/impression',
	authentication,
	role(RoleCode.DELIVERY_COORDINATOR),
	validator(schema.getImpressionInquires, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { filter, page = 1, limit = 10, searchQuery = '' } = req.query;
		const foundInquiries = await InquiryRepo.getImpressionInquires(
			filter as string,
			// req.user._id,
			extractObjectId(req.user.lab),
			+page,
			+limit,
			searchQuery as string,
		);

		return new SuccessResponse('Success', {
			data: foundInquiries[0],
			count: foundInquiries[1],
		}).send(res);
	}),
);

router.put(
	'/addshipment',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.DELIVERY_COORDINATOR),
	authorization,
	validator(schema.addShipment, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiryId, shipmentMethod, trackingId } = req.body;
		const inquiry = await InquiryRepo.findFieldsById(inquiryId, '_id clinic');

		if (!inquiry) throw new BadRequestError('Inquiry not found');

		const updateObj = {
			_id: inquiryId,
			deliveryDetails: {
				service: shipmentMethod,
				trackingId: trackingId,
			},
			impressionStatus: ImpressionStatus.IN_PROGRESS,
		} as Inquiry;

		await InquiryRepo.update(updateObj);

		return new SuccessResponse('Success', updateObj).send(res);
	}),
);

router.put(
	'/impression/receive',
	authentication,
	role(RoleCode.DELIVERY_COORDINATOR, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.receiveImpression, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { patientId } = req.body;

		const foundInquiries = await InquiryRepo.getPatientInquires(patientId);

		let inquiryId: Types.ObjectId | null = null;
		let treatmentPlanner: Types.ObjectId | null = null;

		foundInquiries.forEach((inquiry: Inquiry) => {
			if (inquiry.impressionStatus === ImpressionStatus.IN_PROGRESS) {
				inquiryId = inquiry._id;
				treatmentPlanner = inquiry.treatmentPlanner
					? extractObjectId(inquiry.treatmentPlanner)
					: null;
				return;
			}
		});

		if (!inquiryId) {
			throw new BadRequestError('No product to receive');
		}

		await InquiryRepo.update({
			_id: inquiryId as Types.ObjectId,
			impressionStatus: ImpressionStatus.DELIVERED,
			impressionRecievedBy: req.user._id,
		} as Inquiry);

		if (treatmentPlanner) {
			inquiryEvent.onImpressionDelivered(inquiryId);
		}

		return new SuccessResponse('Received', inquiryId).send(res);
	}),
);

router.put(
	'/shipment/delivered',
	authentication,
	role(RoleCode.DENTIST),
	authorization,
	validator(schema.addShipment, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiryId, shipmentMethod, trackingId } = req.body;
		const inquiry = await InquiryRepo.findFieldsById(inquiryId, '_id clinic');

		if (!inquiry) throw new BadRequestError('Inquiry not found');

		const updateObj = {
			_id: inquiryId,
			deliveryDetails: {
				service: shipmentMethod,
				trackingId: trackingId,
			},
			impressionStatus: ImpressionStatus.IN_PROGRESS,
		} as Inquiry;

		await InquiryRepo.update(updateObj);

		return new SuccessResponse('Success', updateObj).send(res);
	}),
);

router.put(
	'/assign/planner',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.assignTreatmentPlanner, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry, treatmentPlanner } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'treatmentPlanner',
			'impressionStatus',
			'quoteStatus',
			'patient',
			'quoteEstimationDate',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');
		if (foundInquiry.treatmentPlanner)
			throw new BadRequestError('Already assigned');
		if (foundInquiry.quoteEstimationDate)
			throw new BadRequestError('Estimation is already set');
		if (foundInquiry.quoteStatus !== QuoteStatus.PENDING)
			throw new BadRequestError('Quote submission is not pending');

		const data = await InquiryRepo.update({
			_id: inquiry,
			treatmentPlanner,
		} as Inquiry);

		await ChatRoomRepo.addUsersToRoom(foundInquiry.patient.toString(), [
			treatmentPlanner,
		]);

		await ChatRoomRepo.addUsersToRoom(`lab${foundInquiry.patient.toString()}`, [
			treatmentPlanner,
		]);

		inquiryEvent.onAssignTreatmentPlanner(inquiry);

		return new SuccessResponse('success', data).send(res);
	}),
);

router.put(
	'/selfassign/planner',
	authentication,
	role(RoleCode.TREATMENT_PLANNER, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.selfAssignInquiry, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'treatmentPlanner',
			'impressionStatus',
			'patient',
			'quoteStatus',
			'quoteEstimationDate',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');
		if (foundInquiry.treatmentPlanner)
			throw new BadRequestError('Already assigned');
		if (foundInquiry.quoteEstimationDate)
			throw new BadRequestError('Estimation is already set');

		const data = await InquiryRepo.update({
			_id: inquiry,
			treatmentPlanner: req.user._id,
		} as Inquiry);

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
	'/getWithFilter',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getWithSearchFilterPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			filter,
			page = 1,
			limit = 10,
			searchQuery = null,
			sortField = 'quoteEstimationDate',
			sortOrder = 'desc',
		} = req.query;

		const data = await InquiryRepo.getInquiresWithFilterPaginated(
			filter as string,
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			req.user.clinic ? extractObjectId(req.user.clinic) : null,
			sortField as string,
			sortOrder as string,
		);

		return new SuccessResponse('Success', {
			inquires: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/new/getWithFilter',
	authentication,
	role(RoleCode.TREATMENT_PLANNER),
	authorization,
	validator(schema.getNewWithSearchFilterPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { filter, page = 1, limit = 10, searchQuery = null } = req.query;

		const data = await InquiryRepo.getNewInquiresWithFilterPaginated(
			filter as string,
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			req.user.clinic ? extractObjectId(req.user.clinic) : null,
		);

		return new SuccessResponse('Success', {
			inquires: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/my/getWithFilter',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.TREATMENT_PLANNER),
	authorization,
	validator(schema.getMyWithSearchFilterPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			filter,
			page = 1,
			limit = 10,
			searchQuery = null,
			treatmentPlanner = null,
		} = req.query;

		const role = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

		if (!role) throw new BadRequestError('Role not found');

		const isLabAdmin = req.user.role._id.equals(role._id);

		const plannerId = isLabAdmin
			? treatmentPlanner ?? req.user._id
			: req.user._id;

		const data = await InquiryRepo.getMyWithSearchFilterPaginated(
			filter as string,
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			plannerId as Types.ObjectId,
			req.user.clinic ? extractObjectId(req.user.clinic) : null,
		);

		return new SuccessResponse('Success', {
			inquires: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/:inquiryId',
	authentication,
	role(...Object.values(RoleCode)),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundInquiry = await InquiryRepo.findById(
			new Types.ObjectId(req.params.inquiryId),
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');

		foundInquiry.order = await OrderRepo.findFieldsById(
			foundInquiry.order as Types.ObjectId,
			'_id',
			'quoteDetails',
			'quoteHistory',
			'createdAt',
		);

		const loggedInRole = await RoleRepo.findFieldsById(
			req.user.role._id,
			'code',
		);

		if (
			loggedInRole &&
			[RoleCode.DENTIST, RoleCode.DENTIST_ADMIN].includes(loggedInRole.code)
		) {
			const foundClinic = await ClinicRepo.findFieldsById(
				foundInquiry.clinic as Types.ObjectId,
				'pricingPlan',
			);

			if (!foundClinic) throw new BadRequestError('Clinic not found');

			const cachedExchangeRates: any = await getJson(
				getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
			);

			let currency = 0;
			if (cachedExchangeRates) {
				const value = cachedExchangeRates[foundClinic.pricingPlan.currency];

				currency = Number(value);
			}

			foundClinic.dueAmount = foundClinic.dueAmount * Number(currency);
			foundClinic.paidAmount = foundClinic.paidAmount * Number(currency);

			if (foundInquiry.order) {
				foundInquiry.order.quoteDetails.price =
					foundInquiry.order.quoteDetails.price * currency;
			}
		}

		return new SuccessResponse('Success', foundInquiry).send(res);
	}),
);

router.put(
	'/:id/delete',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getByInquiryId, ValidationSource.PARAM),
	asyncHandler(async (req, res) => {
		const inquiry = await InquiryRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!inquiry) throw new BadRequestError('Inquiry not found');

		inquiry.isDeleted = true;

		const updatedInquiry = await InquiryRepo.updateById(
			new Types.ObjectId(req.params.id),
			inquiry,
		);

		if (!updatedInquiry) throw new BadRequestError('Inquiry not updated');

		return new SuccessResponse('Inquiry deleted successfully', {}).send(res);
	}),
);

router.put(
	'/:id/undo',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getByInquiryId, ValidationSource.PARAM),
	asyncHandler(async (req, res) => {
		const inquiry = await InquiryRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!inquiry) throw new BadRequestError('Inquiry not found');

		inquiry.isDeleted = false;

		const updatedInquiry = await InquiryRepo.updateById(
			new Types.ObjectId(req.params.id),
			inquiry,
		);

		if (!updatedInquiry) throw new BadRequestError('Inquiry not updated');

		return new SuccessResponse('Inquiry restored successfully', {}).send(res);
	}),
);

router.get(
	'/lab/getDeleted',
	role(RoleCode.LAB_ADMIN),
	authorization,
	asyncHandler(async (req, res) => {
		const { page = 1, limit = 10 } = req.query;
		const data = await InquiryRepo.getDeletedInquiries(+page, +limit);

		return new SuccessResponse('Success', {
			inquiry: data[0],
			count: data[1],
		}).send(res);
	}),
);

export default router;
