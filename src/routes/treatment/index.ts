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
import InquiryRepo from '../../database/Inquiry/repo';
import OrderRepo from '../../database/Order/repo';
import ClinicRepo from '../../database/Clinic/repo';
import UserRepo from '../../database/User/repo';
import RoleRepo from '../../database/Role/repo';
import LabRepo from '../../database/Lab/repo';
import { Types } from 'mongoose';
import _ from 'lodash';
import Order, { OrderStatus } from '../../database/Order/model';
import Inquiry, { ImpressionStatus } from '../../database/Inquiry/model';
import { ProductType } from '../../database/Inquiry/types';
import { getJson } from '../../cache/query';
import { DynamicKey, getDynamicKey } from '../../cache/keys';
import { Currency } from '../../database/Clinic/model';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.get(
	'/details',
	role(...Object.values(RoleCode)),
	authorization,
	validator(schema.getDetails, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { patient } = req.query;

		const foundPatient = await UserRepo.findFieldsById(
			patient as unknown as Types.ObjectId,
			'name',
			'profilePicUrl',
			'gender',
			'dob',
			'userId',
			'dentist',
			'clinic',
			'lab',
			'email',
			'countryCode',
			'phoneNumber',
		);

		if (!foundPatient) throw new BadRequestError('Patient not found');

		const foundClinic = await ClinicRepo.findById(
			extractObjectId(foundPatient.clinic as Types.ObjectId),
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const exchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
		);

		let currency = 0;
		if (exchangeRates) {
			const value = exchangeRates[foundClinic.pricingPlan.currency] ?? 0;

			currency = Number(value);
		}

		const foundDentist = await UserRepo.findFieldsById(
			extractObjectId(foundPatient.dentist as Types.ObjectId),
			'name',
			'email',
			'countryCode',
			'phoneNumber',
		);

		const clinicDetails = {
			name: foundClinic.name,
			profilePicUrl: foundClinic.profilePicUrl,
			address: foundClinic.address,
			phoneNumber: foundClinic.phoneNumber,
			countryCode: foundClinic.countryCode,
			pricingPlan: {
				type: foundClinic.pricingPlan.type,
				currency: foundClinic.pricingPlan.currency,
				price: (foundClinic.pricingPlan.price || 0) * currency,
				simpleCasePrice:
					(foundClinic.pricingPlan.simpleCasePrice || 0) * currency,
				moderateCasePrice:
					(foundClinic.pricingPlan.moderateCasePrice || 0) * currency,
				complexCasePrice:
					(foundClinic.pricingPlan.complexCasePrice || 0) * currency,
			},
			dueAmount: foundClinic.dueAmount * Number(currency),
			paidAmount: foundClinic.paidAmount * Number(currency),
			dentistName: foundDentist?.name,
			dentistEmail: foundDentist?.email,
			dentistPhone: `${foundDentist?.countryCode}${foundDentist?.phoneNumber}`,
		};

		const patientDetails = {
			...foundPatient,
		};

		const treatmentDetails: any = {
			archType: null,
			restrictedTooth: [],
			extractedTooth: [],
			presentationFolder: '',
			impressionStatus: ImpressionStatus.NONE,
			deliveryDetails: {},
			treatmentPlanner: '',
			noOfAlignerSet: 0,
			caseComplexity: '',
			alignerExternalImages: [],
			refinerExternalImages: [],
			alignerStl: [],
			refinerStl: [],
			price: 0,
			note: '',
			anterior: '',
			overJet: '',
			overBite: '',
			biteRamps: '',
			midLine: '',
			spacing: '',
			spacingCrowding: [],
			quoteHistory: [],
			submitDate: null,
		};

		enum ProgressStatus {
			NOT_ORDERED = 'NOT_ORDERED',
			ORDERED = 'ORDERED',
			MANUFACTURING = 'MANUFACTURING',
			DELIVERY_PENDING = 'DELIVERY_PENDING',
			SHIPPED = 'SHIPPED',
			DELIVERED = 'DELIVERED',
		}

		let activeStage = 'Aligners';

		const getStatus = (status: OrderStatus) => {
			let newStatus: ProgressStatus = ProgressStatus.ORDERED;
			switch (status) {
				case OrderStatus.PENDING:
					newStatus = ProgressStatus.NOT_ORDERED;
					break;
				case OrderStatus.PRODUCTION_PENDING:
					newStatus = ProgressStatus.MANUFACTURING;
					break;
				case OrderStatus.DELIVERY_PENDING:
					newStatus = ProgressStatus.DELIVERY_PENDING;
					break;
				case OrderStatus.IN_SHIPMENT:
					newStatus = ProgressStatus.SHIPPED;
					break;
				case OrderStatus.DELIVERED:
					newStatus = ProgressStatus.DELIVERED;
					break;
				default:
					break;
			}

			return newStatus;
		};

		const allInquires = [];

		const foundAligner = await InquiryRepo.getByPatientAndProdType(
			foundPatient._id,
			ProductType.ALIGNER,
		);

		if (!foundAligner)
			throw new BadRequestError('Patient treatment not yet started');

		treatmentDetails.impressionStatus = foundAligner.impressionStatus;
		treatmentDetails.deliveryDetails = foundAligner.deliveryDetails || {};

		allInquires.push(foundAligner);

		const foundRefiner = await InquiryRepo.getByPatientAndProdType(
			foundPatient._id,
			ProductType.REFINER,
		);

		if (foundRefiner) allInquires.push(foundRefiner);

		const foundRetainer = await InquiryRepo.getByPatientAndProdType(
			foundPatient._id,
			ProductType.RETAINER,
		);

		if (foundRetainer) allInquires.push(foundRetainer);

		const orders: any[] = [];

		let foundOrder: Order | null = null;

		if (foundAligner.order) {
			foundOrder = await OrderRepo.findDetailById(
				extractObjectId(foundAligner.order),
			);
		}

		let alignercount = 0;
		foundOrder?.deliveries.forEach((delivery) => {
			let inquiryId: Types.ObjectId | null = foundAligner._id;

			if (delivery.prodType === ProductType.ALIGNER) {
				alignercount++;
			}

			if (delivery.prodType === ProductType.REFINER) {
				inquiryId = foundRefiner?._id ?? null;
			}

			if (delivery.prodType === ProductType.RETAINER) {
				inquiryId = foundRetainer?._id ?? null;
			}

			let name: string = delivery.prodType.toLowerCase();
			name = name.charAt(0).toUpperCase() + name.slice(1);
			if (delivery.prodType === ProductType.ALIGNER) {
				name = `Phase ${alignercount}`;

				if (delivery.totalAligners === foundOrder?.quoteDetails.totalAligners) {
					name = 'Aligner';
				}
			}

			if (activeStage === 'Aligners' || activeStage.length === 0) {
				activeStage = name;
			}

			if (delivery.status === OrderStatus.DELIVERED) {
				activeStage = '';
			}

			orders.push({
				name,
				prodType: delivery.prodType,
				status: getStatus(delivery.status),
				inquiryId: inquiryId,
				orderId: foundOrder?._id,
				subOrderId: delivery._id,
				foundAligner: delivery.totalAligners,
				productionManager: delivery.productionManager,
				deliveryCoordinator: delivery.deliveryCoordinator,
			});
		});

		if (
			orders.findIndex((order) => order.prodType === ProductType.ALIGNER) === -1
		) {
			orders.push({
				name: 'Aligners',
				status: ProgressStatus.ORDERED,
				prodType: ProductType.ALIGNER,
				inquiryId: foundAligner._id,
				orderId: null,
				subOrderId: null,
				foundAligner: 0,
			});
		}

		if (
			orders.findIndex((order) => order.prodType === ProductType.REFINER) === -1
		) {
			if (_.isEmpty(activeStage)) activeStage = 'Refiner';
			orders.push({
				name: 'Refiner',
				status: ProgressStatus.NOT_ORDERED,
				prodType: ProductType.REFINER,
				inquiryId: foundRefiner?._id,
				orderId: null,
				subOrderId: null,
				foundAligner: 0,
			});
		}

		if (
			orders.findIndex((order) => order.prodType === ProductType.RETAINER) ===
			-1
		) {
			if (_.isEmpty(activeStage)) activeStage = 'Retainer';
			orders.push({
				name: 'Retainer',
				status: ProgressStatus.NOT_ORDERED,
				prodType: ProductType.RETAINER,
				inquiryId: foundRetainer?._id,
				orderId: null,
				subOrderId: null,
				foundAligner: 0,
			});
		}

		allInquires.forEach((inq: Inquiry) => {
			const inqQuote = foundOrder;

			treatmentDetails.submitDate = inqQuote?.createdAt;
			treatmentDetails.quoteHistory = inqQuote?.quoteHistory;
			treatmentDetails.price = (foundOrder?.quoteDetails.price || 0) * currency;
			treatmentDetails.note = _.isEmpty(inq.treatmentDetails.note)
				? treatmentDetails.note ?? ''
				: inq.treatmentDetails.note;

			treatmentDetails.anterior = _.isEmpty(inq.treatmentDetails.anterior)
				? treatmentDetails.anterior ?? ''
				: inq.treatmentDetails.anterior;

			treatmentDetails.overJet = _.isEmpty(inq.treatmentDetails.overJet)
				? treatmentDetails.overJet ?? ''
				: inq.treatmentDetails.overJet;

			treatmentDetails.overBite = _.isEmpty(inq.treatmentDetails.overBite)
				? treatmentDetails.overBite ?? ''
				: inq.treatmentDetails.overBite;

			treatmentDetails.biteRamps = _.isEmpty(inq.treatmentDetails.biteRamps)
				? treatmentDetails.biteRamps ?? ''
				: inq.treatmentDetails.biteRamps;

			treatmentDetails.midLine = _.isEmpty(inq.treatmentDetails.midLine)
				? treatmentDetails.midLine ?? ''
				: inq.treatmentDetails.midLine;

			treatmentDetails.spacing = _.isEmpty(inq.treatmentDetails.spacing)
				? treatmentDetails.spacing ?? ''
				: inq.treatmentDetails.spacing;

			if (!_.isEmpty(inq.archSide)) {
				treatmentDetails.archType = inq.archSide;
			}
			treatmentDetails.restrictedTooth = [
				...treatmentDetails.restrictedTooth,
				...inq.treatmentDetails.restrictedTooth,
			];
			treatmentDetails.extractedTooth = [
				...treatmentDetails.extractedTooth,
				...inq.treatmentDetails.extractedTooth,
			];
			treatmentDetails.spacingCrowding = [
				...treatmentDetails.spacingCrowding,
				...(inq.treatmentDetails.spacingCrowding || []),
			];
			treatmentDetails.presentationFolder =
				inqQuote?.quoteDetails.presentationFolder;
			treatmentDetails.caseComplexity = inqQuote?.quoteDetails.caseComplexity;
			treatmentDetails.noOfAlignerSet = inqQuote?.quoteDetails.totalAligners;
			if (inq.prodType == ProductType.ALIGNER) {
				treatmentDetails.alignerExternalImages = inq.externalImages;
				treatmentDetails.alignerStl = inq.impressionFiles;
			}
			if (inq.prodType == ProductType.REFINER) {
				treatmentDetails.refinerExternalImages = inq.externalImages;
				treatmentDetails.refinerStl = inq.impressionFiles;
			}
		});

		new SuccessResponse('Success', {
			treatmentDetails,
			orders,
			clinicDetails,
			patientDetails,
			activeStage,
		}).send(res);
	}),
);

router.get(
	'/clinic',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getByClinic, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			searchQuery,
			page = 1,
			limit = 10,
			clinicId,
			dentistId,
			filter,
		} = req.query;

		const foundOrders = await OrderRepo.getOrdersOfClinic(
			clinicId as unknown as Types.ObjectId,
			dentistId as unknown as Types.ObjectId,
			(searchQuery as string) || '',
			+page,
			+limit,
			filter as string,
		);

		const ordersWithStatus: any[] = [];
		for (const order of foundOrders[0]) {
			let treatmentStatus = 'Aligner';
			if (order.deliveries.length) {
				order.deliveries.forEach((delivery) => {
					treatmentStatus = delivery.prodType || 'Aligner';
					if (delivery.status === OrderStatus.DELIVERED) {
						treatmentStatus = 'COMPLETED';
					}
				});
			}
			treatmentStatus = treatmentStatus.toLowerCase();
			treatmentStatus =
				treatmentStatus.charAt(0).toUpperCase() + treatmentStatus.slice(1);
			ordersWithStatus.push({
				...order,
				treatmentStatus,
				deliveries: [],
			});
		}

		new SuccessResponse('Success', {
			data: ordersWithStatus,
			count: foundOrders[1][0]?.count ?? 0,
		}).send(res);
	}),
);

export default router;
