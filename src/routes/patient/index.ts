import express from 'express';
import _ from 'lodash';
import { Types } from 'mongoose';
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
import UserRepo from '../../database/User/repo';
import User from '../../database/User/model';
import Order, { OrderStatus } from '../../database/Order/model';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.get(
	'/search',
	role(RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.search, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		if (!req.user.clinic)
			throw new BadRequestError('The user does not have a clinic.');

		const foundPatients = await UserRepo.searchPatient(
			(req.query.searchVal as string) || '',
			extractObjectId(req.user.clinic),
		);

		new SuccessResponse('Success', foundPatients).send(res);
	}),
);

router.get(
	'/lab/search',
	role(
		RoleCode.LAB_ADMIN,
		RoleCode.DELIVERY_COORDINATOR,
		RoleCode.PRODUCTION_MANAGER,
		RoleCode.TREATMENT_PLANNER,
	),
	authorization,
	validator(schema.search, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundPatients = await UserRepo.searchPatientInLab(
			(req.query.searchVal as string) || '',
			extractObjectId(req.user.lab),
		);

		new SuccessResponse('Success', foundPatients).send(res);
	}),
);

router.get(
	'/searchPatient/:id',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchQuery, page = 1, limit = 10 } = req.query;
		const foundDentist = await UserRepo.findPatientsByDentist(
			new Types.ObjectId(req.params.id),
			(searchQuery as string) || '',
			+page,
			+limit,
		);

		interface UserWithOrders extends User {
			orders: Order[];
			productionManager: User | null;
			treatmentStatus: string;
		}

		const dentistWithStatus: UserWithOrders[] = [];
		for (const dentist of foundDentist[0]) {
			let treatmentStatus = 'Aligners';
			let productionManagerId: Types.ObjectId | null = null;

			if (dentist.orders.length) {
				dentist.orders[0].deliveries.forEach((delivery) => {
					treatmentStatus = delivery.prodType || 'Aligners';
					if (delivery.status === OrderStatus.DELIVERED) {
						treatmentStatus = 'COMPLETED';
					}
					if (delivery.productionManager) {
						productionManagerId = extractObjectId(delivery.productionManager);
					}
				});
			}

			let productionManager = null;
			if (productionManagerId) {
				productionManager = await UserRepo.findFieldsById(
					productionManagerId,
					'name',
				);
			}

			treatmentStatus = treatmentStatus.toLowerCase();
			treatmentStatus =
				treatmentStatus.charAt(0).toUpperCase() + treatmentStatus.slice(1);

			dentistWithStatus.push({
				...dentist,
				treatmentStatus,
				orders: [],
				productionManager,
			});
		}

		new SuccessResponse('Success', {
			patients: dentistWithStatus,
			count: foundDentist[1],
		}).send(res);
	}),
);

router.get(
	'/clinic/search',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getPatientByClinicId, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchQuery, clinic, page = 1, limit = 10 } = req.query;

		const foundDentists = await UserRepo.findPatientsByClinic(
			new Types.ObjectId(clinic as string),
			(searchQuery as string) || '',
			+page,
			+limit,
		);

		interface UserWithOrders extends User {
			orders: Order[];
			productionManager: User | null;
			treatmentStatus: string;
		}

		const dentistWithStatus: UserWithOrders[] = [];
		for (const dentist of foundDentists[0]) {
			let treatmentStatus = 'Aligners';
			let productionManagerId: Types.ObjectId | null = null;

			if (dentist.orders.length) {
				dentist.orders[0].deliveries.forEach((delivery) => {
					treatmentStatus = delivery.prodType || 'Aligners';
					if (delivery.status === OrderStatus.DELIVERED) {
						treatmentStatus = 'COMPLETED';
					}
					if (delivery.productionManager) {
						productionManagerId = extractObjectId(delivery.productionManager);
					}
				});
			}

			let productionManager = null;
			if (productionManagerId) {
				productionManager = await UserRepo.findFieldsById(
					productionManagerId,
					'name',
				);
			}

			treatmentStatus = treatmentStatus.toLowerCase();
			treatmentStatus =
				treatmentStatus.charAt(0).toUpperCase() + treatmentStatus.slice(1);

			dentistWithStatus.push({
				...dentist,
				treatmentStatus,
				orders: [],
				productionManager,
			});
		}

		new SuccessResponse('Success', {
			patients: dentistWithStatus,
			count: foundDentists[1],
		}).send(res);
	}),
);

router.get(
	'/userid',
	role(
		RoleCode.LAB_ADMIN,
		RoleCode.DENTIST_ADMIN,
		RoleCode.DENTIST,
		RoleCode.DELIVERY_COORDINATOR,
		RoleCode.PRODUCTION_MANAGER,
		RoleCode.TREATMENT_PLANNER,
	),
	authorization,
	validator(schema.getPatientById, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const userId = req.query.userId;

		const patient = await UserRepo.getPatientByUserId(
			userId as string,
			extractObjectId(req.user.lab),
			req.user.clinic ? extractObjectId(req.user.clinic) : null,
		);

		if (!patient) throw new BadRequestError('patient not found');

		return new SuccessResponse(
			'success',
			_.pick(patient, ['_id', 'name', 'userId']),
		).send(res);
	}),
);

export default router;
