import express from 'express';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import { BadRequestError, ForbiddenError } from '../../core/ApiError';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import { RoleCode } from '../../database/Role/model';
import InquiryRepo from '../../database/Inquiry/repo';
import RoleRepo from '../../database/Role/repo';
import ClinicRepo from '../../database/Clinic/repo';
import OrderRepo from '../../database/Order/repo';
import _ from 'lodash';
import Order, {
	CaseComplexity,
	Delivery,
	DeliveryType,
	OrderStatus,
	QuoteHistory,
	QuoteStatus,
} from '../../database/Order/model';
import Inquiry, {
	ImpressionStatus,
	ImpressionType,
} from '../../database/Inquiry/model';
import { Types } from 'mongoose';
import { PricingType } from '../../database/Clinic/model';
import Clinic from '../../database/Clinic/model';
import { quoteEvent, inquiryEvent, orderEvent } from '../../events/index';
import { ProductType } from '../../database/Inquiry/types';

const router = express.Router();

router.post(
	'/',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.TREATMENT_PLANNER),
	authorization,
	validator(schema.createQuote, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		let isAdmin = false;
		const role = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

		if (role?._id.equals(req.user.role._id)) {
			isAdmin = true;
		}

		const foundInquiry = await InquiryRepo.findFieldsById(
			req.body.inquiry,
			'impressionStatus',
			'impressionType',
			'clinic',
			'lab',
			'patient',
			'dentist',
			'order',
		);

		if (!foundInquiry) throw new BadRequestError('Inquriry not found');

		if (foundInquiry.order) {
			const foundOrder = await OrderRepo.findFieldsById(
				extractObjectId(foundInquiry.order),
				'quoteHistory',
				'quoteDetails',
				'createdAt',
			);

			if (!foundOrder) throw new BadRequestError('Order not found');

			const newQuoteHistory = foundOrder.quoteHistory;
			newQuoteHistory.push({
				caseComplexity: foundOrder.quoteDetails.caseComplexity,
				totalAligners: foundOrder.quoteDetails.totalAligners,
				price: foundOrder.quoteDetails.price,
				note: foundOrder.quoteDetails.note,
				reworkNote: foundOrder.quoteDetails.reworkNote,
				presentationFolder: foundOrder.quoteDetails.presentationFolder,
				presentationPdf: foundOrder.quoteDetails.presentationPdf,
				isRevision: foundOrder.quoteDetails.isRevision,
				revisionNote: foundOrder.quoteDetails.revisionNote,
				submitDate: foundOrder.createdAt,
			} as QuoteHistory);

			req.body.quoteHistory = newQuoteHistory;

			await OrderRepo.deleteById(extractObjectId(foundInquiry.order));
		}

		// exclude impression condition
		// if (
		// 	foundInquiry.impressionType == ImpressionType.PHYSICAL &&
		// 	foundInquiry.impressionStatus != ImpressionStatus.DELIVERED
		// ) {
		// 	throw new BadRequestError('Impression is not delivered');
		// }

		const clinic = await ClinicRepo.findFieldsById(
			foundInquiry.clinic as Types.ObjectId,
			'pricingPlan',
		);

		let price = 0;

		switch (clinic?.pricingPlan.type) {
			case PricingType.PER_ALIGNER:
				price =
					req.body.quoteDetails.totalAligners * (clinic.pricingPlan.price || 0);
				break;
			case PricingType.PER_CASE:
				if (req.body.quoteDetails.caseComplexity === CaseComplexity.SIMPLE) {
					price = clinic.pricingPlan.simpleCasePrice as number;
				}
				if (req.body.quoteDetails.caseComplexity === CaseComplexity.MODERATE) {
					price = clinic.pricingPlan.moderateCasePrice as number;
				}
				if (req.body.quoteDetails.caseComplexity === CaseComplexity.COMPLEX) {
					price = clinic.pricingPlan.complexCasePrice as number;
				}
			default:
				break;
		}

		req.body.quoteDetails.price = price;
		req.body.lab = foundInquiry.lab;
		req.body.clinic = foundInquiry.clinic;
		req.body.patient = foundInquiry.patient;
		req.body.dentist = foundInquiry.dentist;

		const createdOrder = await OrderRepo.create(
			req.body,
			req.user._id,
			isAdmin ? req.user._id : null,
		);

		if (!createdOrder) throw new BadRequestError('Order is not created');

		if (isAdmin) {
			quoteEvent.onPresentationApproved(createdOrder._id, req.user._id);
		} else {
			quoteEvent.onQuoteCreated(createdOrder);
		}

		new SuccessResponse('Success', createdOrder).send(res);
	}),
);

router.put(
	'/setEstimation',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.TREATMENT_PLANNER),
	authorization,
	validator(schema.setEstimation, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { date, inquiry } = req.body;

		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiry,
			'quoteEstimationDate',
			'quoteStatus',
			'treatmentPlanner',
		);

		if (!foundInquiry) throw new BadRequestError('Inquiry not found');
		if (!foundInquiry.treatmentPlanner)
			throw new BadRequestError('Treatment planner is not assigned');
		if (foundInquiry.quoteStatus != QuoteStatus.PENDING)
			throw new BadRequestError('Already processed');
		if (!req.user._id.equals(foundInquiry.treatmentPlanner as Types.ObjectId)) {
			throw new ForbiddenError();
		}
		if (foundInquiry.quoteEstimationDate)
			throw new BadRequestError('Estimation is already set');

		foundInquiry.quoteEstimationDate = date;
		await InquiryRepo.update({
			_id: inquiry,
			quoteEstimationDate: date,
		} as Inquiry);

		inquiryEvent.onPlannerSetDate(foundInquiry._id);

		new SuccessResponse('success', req.body).send(res);
	}),
);

router.get(
	'/dental/getWithFilter',
	authentication,
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.getWithSearchFilterPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { filter, page = 1, limit = 10, searchQuery = null } = req.query;

		let isAdmin = false;
		const role = await RoleRepo.findByCode(RoleCode.DENTIST_ADMIN);

		if (role?._id.equals(req.user.role._id)) {
			isAdmin = true;
		}

		const data = await InquiryRepo.getInquiryWithFilterPaginated(
			filter as string,
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			extractObjectId(req.user.clinic as Types.ObjectId),
			isAdmin ? null : req.user._id,
		);

		return new SuccessResponse('Success', {
			inquires: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/reviewWithFilter',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getReviewWithSearchFilterPaginated, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { filter, page = 1, limit = 10, searchQuery = null } = req.query;

		const data = await InquiryRepo.getReviewsWithFilterPaginated(
			filter as string,
			searchQuery as string,
			+page,
			+limit,
			extractObjectId(req.user.lab),
			req.user.clinic ? extractObjectId(req.user.clinic) : null,
		);

		return new SuccessResponse('Success', {
			quotes: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.post(
	'/placeorder',
	authentication,
	role(RoleCode.DENTIST, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.placeOrder, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { order: orderId } = req.body;

		const canPlaceOrder = req.user.privilege.createOrder;

		const foundOrder = await OrderRepo.findFieldsById(
			orderId,
			'deliveries',
			'quoteDetails',
			'inquiry',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		const foundClinic = await ClinicRepo.findFieldsById(
			foundOrder.clinic as Types.ObjectId,
			'dueAmount',
			'paidAmount',
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const newOrder: Delivery = {
			_id: new Types.ObjectId(),
			prodType: ProductType.ALIGNER,
			dentist: req.user._id,
			productionManager: null,
			productionEstimationDate: null,
			deliveryCoordinator: null,
			deliveryDetails: {
				deliveryType: DeliveryType.SELF,
			},
			totalAligners: foundOrder.quoteDetails.totalAligners,
			status: OrderStatus.DENTIST_APPROVED,
		};

		await OrderRepo.update({
			_id: orderId,
			approvedDate: canPlaceOrder ? new Date() : null,
			deliveries: [newOrder],
			quoteDetails: {
				...foundOrder.quoteDetails,
				status: canPlaceOrder
					? QuoteStatus.DENTIST_APPROVED
					: QuoteStatus.DENTIST_REVIEWED,
			},
		} as Order);

		await InquiryRepo.update({
			_id: foundOrder.inquiry,
			quoteStatus: canPlaceOrder
				? QuoteStatus.DENTIST_APPROVED
				: QuoteStatus.DENTIST_REVIEWED,
		} as Inquiry);

		const totalAmount =
			(foundClinic.dueAmount ?? 0) + (foundOrder.quoteDetails.price ?? 0);

		await ClinicRepo.update({
			_id: extractObjectId(foundOrder.clinic._id)
				? foundOrder.clinic._id
				: foundOrder.clinic,
			dueAmount: canPlaceOrder ? totalAmount : foundClinic.dueAmount ?? 0,
		} as Clinic);

		if (!canPlaceOrder) {
			quoteEvent.onQuoteReview(extractObjectId(foundOrder._id));
		}

		new SuccessResponse('Order placed', req.body).send(res);
	}),
);

router.post(
	'/placeorder/approval',
	authentication,
	role(RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.placeOrderApproval, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { order: orderId, status } = req.body;

		const foundOrder = await OrderRepo.findFieldsById(
			orderId,
			'quoteDetails',
			'inquiry',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		const foundClinic = await ClinicRepo.findFieldsById(
			foundOrder.clinic as Types.ObjectId,
			'dueAmount',
			'paidAmount',
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		if (foundOrder.quoteDetails.status !== QuoteStatus.DENTIST_REVIEWED) {
			throw new BadRequestError('Order not reviewed');
		}

		await OrderRepo.update({
			_id: orderId,
			approvedDate: new Date(),
			quoteDetails: {
				...foundOrder.quoteDetails,
				status:
					status == 'APPROVE'
						? QuoteStatus.DENTIST_APPROVED
						: QuoteStatus.DENTIST_CANCELED,
			},
		} as Order);

		await InquiryRepo.update({
			_id: foundOrder.inquiry,
			quoteStatus:
				status == 'APPROVE'
					? QuoteStatus.DENTIST_APPROVED
					: QuoteStatus.DENTIST_CANCELED,
		} as Inquiry);

		const totalAmount =
			(foundClinic.dueAmount ?? 0) + (foundOrder.quoteDetails.price ?? 0);

		await ClinicRepo.update({
			_id: extractObjectId(foundOrder.clinic._id)
				? foundOrder.clinic._id
				: foundOrder.clinic,
			dueAmount: totalAmount,
		} as Clinic);

		orderEvent.onApproveOrder(extractObjectId(foundOrder.inquiry));

		new SuccessResponse(`Quote ${status.toLowerCase()}`, req.body).send(res);
	}),
);

router.post(
	'/cancel',
	authentication,
	role(RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.cancelQuote, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { order: orderId } = req.body;

		const foundOrder = await OrderRepo.findFieldsById(
			orderId,
			'quoteDetails',
			'inquiry',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		if (foundOrder.quoteDetails.status !== QuoteStatus.ADMIN_APPROVED) {
			throw new BadRequestError('Approval Pending from Lab');
		}

		await OrderRepo.update({
			_id: orderId,
			quoteDetails: {
				...foundOrder.quoteDetails,
				status: QuoteStatus.DENTIST_CANCELED,
			},
		} as Order);

		await InquiryRepo.update({
			_id: foundOrder.inquiry,
			quoteStatus: QuoteStatus.DENTIST_CANCELED,
		} as Inquiry);

		new SuccessResponse(`The quote has been canceled.`, req.body).send(res);
	}),
);

router.post(
	'/updatestatus',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.updateStatus, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { inquiry: inquiryId, status, message = null } = req.body;

		const inquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'_id',
			'order',
			'quoteStatus',
			'treatmentPlanner',
		);

		if (!inquiry || !inquiry.order)
			throw new BadRequestError('No inquiry found');

		const order = await OrderRepo.findFieldsById(
			extractObjectId(inquiry.order),
			'_id',
			'inquiry',
			'quoteDetails',
		);

		if (!order) throw new BadRequestError('No order found');

		switch (status) {
			case QuoteStatus.PENDING:
				if (order.quoteDetails.status !== QuoteStatus.REWORK) {
					throw new BadRequestError('Status is not in rework state');
				}
				break;
			case QuoteStatus.REWORK:
				if (order.quoteDetails.status !== QuoteStatus.PENDING_APPROVAL) {
					throw new BadRequestError('Status is not in pending approval');
				}
				break;
			case QuoteStatus.ADMIN_APPROVED:
			case QuoteStatus.ADMIN_CANCELED:
				if (order.quoteDetails.status !== QuoteStatus.PENDING_APPROVAL) {
					throw new BadRequestError('Status is not in pending state');
				}
				break;
			default:
				throw new BadRequestError('Status not defined');
				break;
		}

		if (status === QuoteStatus.ADMIN_APPROVED && inquiry.treatmentPlanner) {
			quoteEvent.onPresentationApproved(
				order._id,
				extractObjectId(inquiry.treatmentPlanner),
			);
		}

		if (status === QuoteStatus.REWORK && inquiry.treatmentPlanner) {
			quoteEvent.onQuoteRework(
				inquiry._id,
				extractObjectId(inquiry.treatmentPlanner),
			);
		}

		await OrderRepo.update({
			_id: inquiry.order,
			quoteDetails: {
				...order.quoteDetails,
				reworkNote: message ?? '',
				status,
			},
		} as Order);

		await InquiryRepo.update({
			_id: inquiry._id,
			quoteStatus: status,
		} as Inquiry);

		return new SuccessResponse('success', req.body).send(res);
	}),
);

router.post(
	'/revision',
	authentication,
	role(RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.revision, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { order: orderId, message } = req.body;

		const foundOrder = await OrderRepo.findFieldsById(
			orderId,
			'quoteDetails',
			'inquiry',
			'clinic',
		);

		if (!foundOrder) throw new BadRequestError('Order not found');

		if (foundOrder.quoteDetails.status !== QuoteStatus.ADMIN_APPROVED) {
			throw new BadRequestError('Approval Pending from Lab');
		}

		await OrderRepo.update({
			_id: orderId,
			quoteDetails: {
				...foundOrder.quoteDetails,
				status: QuoteStatus.REWORK,
				isRevision: true,
				revisionNote: message,
			},
		} as Order);

		await InquiryRepo.update({
			_id: foundOrder.inquiry,
			quoteStatus: QuoteStatus.REWORK,
		} as Inquiry);

		new SuccessResponse(`Order sent for rework`, req.body).send(res);
	}),
);

export default router;
