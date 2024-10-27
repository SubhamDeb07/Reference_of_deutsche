import express from 'express';
import { Types } from 'mongoose';
import _ from 'lodash';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, {
	ValidationSource,
	extractObjectId,
} from '../../helpers/validator';
import schema from './schema';
import {
	BadRequestError,
	ForbiddenError,
	InternalError,
} from '../../core/ApiError';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import Role, { RoleCode } from '../../database/Role/model';
import UserRepo from '../../database/User/repo';
import bcrypt from 'bcrypt';
import moment from 'moment';
import ClinicRepo from '../../database/Clinic/repo';
import LabRepo from '../../database/Lab/repo';
import User, { ApprovalStatus } from '../../database/User/model';
import { userEvent } from '../../events';
import { setPasswordMail } from '../../helpers/mail';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.post(
	'/',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.createDentist, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const randomPassword = Math.random().toString(36).slice(-8);
		const hashedPwd = randomPassword;

		const isLabAdmin = _.isObject(req.user.role)
			? (req.user.role as Role).code === RoleCode.LAB_ADMIN
			: false;

		if (!req.user.privilege.createDentist)
			throw new ForbiddenError('Not authorized to create dentist');

		if (isLabAdmin) {
			req.body.approvalStatus = ApprovalStatus.APPROVED;
			req.body.isPermissionAdded = false;
		} else {
			req.body.approvalStatus = ApprovalStatus.PENDING;
			req.body.isPermissionAdded = true;
			req.body.clinic = req.user.clinic
				? extractObjectId(req.user.clinic)
				: null;
		}
		if (req.body.email) {
			const foundUser = await UserRepo.findByEmail(req.body.email);

			if (foundUser) throw new BadRequestError('This email is already in use');
		}

		const createdUser = await UserRepo.create(
			req.body,
			RoleCode.DENTIST,
			extractObjectId(req.user.lab),
			req.body.clinic,
		);

		if (!createdUser)
			throw new InternalError('Unable to create dentist profile');
		if (isLabAdmin) {
			// const verificationToken = bcrypt.hashSync(
			// 	createdUser.user._id.toString() + Date.now().toString(),
			// 	10,
			// );

			await UserRepo.updateInfo({
				_id: createdUser.user._id,
				// verificationToken: {
				// 	token: verificationToken,
				// 	expiresAt: moment().add(90, 'days').toDate(),
				// },
				password: hashedPwd,
			} as User);

			const passwordResetParams = {
				recipientEmail: req.body.email,
				token: randomPassword,
			};

			const foundClinic = await ClinicRepo.findFieldsById(
				req.body.clinic,
				'name',
			);
			const foundLab = await LabRepo.findFieldsById(req.body.clinic, 'name');

			await setPasswordMail(
				passwordResetParams,
				req.body.name,
				foundClinic?.name || 'Clinic',
				foundLab?.name || 'Lab',
				'invitation',
				RoleCode.DENTIST,
			);
		}

		userEvent.onCreateDentist(createdUser.user._id, req.user._id);

		return new SuccessResponse('Success', {
			user: _.pick(createdUser.user, ['_id', 'name', 'profilePicUrl']),
		}).send(res);
	}),
);

router.get(
	'/getAllByFilter',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getAllByFilter, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			page = 1,
			limit = 10,
			approvalStatus = 'ALL',
			searchQuery = '',
			clinic = null,
		} = req.query;

		let clinicId: Types.ObjectId | null = null;

		if (clinic) {
			clinicId = new Types.ObjectId(clinic as string);
		} else {
			clinicId = req.user.clinic ? extractObjectId(req.user.clinic) : null;
		}

		const data = await UserRepo.getDentistsWithFilterPaginated(
			+page,
			+limit,
			req.user._id,
			extractObjectId(req.user.lab),
			clinicId,
			approvalStatus as string,
			searchQuery as string,
		);

		return new SuccessResponse('Found Dentists', {
			dentists: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/reviewApprovalWithFilter',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getAllByFilter, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			page = 1,
			limit = 10,
			approvalStatus = 'ALL',
			searchQuery = '',
			clinic = null,
		} = req.query;

		let clinicId: Types.ObjectId | null = null;

		if (clinic) {
			clinicId = new Types.ObjectId(clinic as string);
		} else {
			clinicId = req.user.clinic ? extractObjectId(req.user.clinic) : null;
		}

		const data = await UserRepo.getApprovalDentistsWithFilterPaginated(
			+page,
			+limit,
			req.user._id,
			extractObjectId(req.user.lab),
			clinicId,
			approvalStatus as string,
			searchQuery as string,
		);

		return new SuccessResponse('Found Dentists', {
			dentists: data[0],
			count: data[1],
		}).send(res);
	}),
);

router.get(
	'/:id',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundDentist = await UserRepo.findPublicProfileById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundDentist) throw new BadRequestError('Dentist not found');

		if (!foundDentist.clinic) throw new BadRequestError('Clinic not found');

		const foundClinic = await ClinicRepo.findById(
			extractObjectId(foundDentist.clinic),
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		return new SuccessResponse('success', {
			dentist: foundDentist,
			clinic: foundClinic,
		}).send(res);
	}),
);

router.put(
	'/update/:id',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.updateDentist, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundDentist = await UserRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundDentist) throw new BadRequestError('Dentist not found');

		await UserRepo.updateInfo({
			_id: req.params.id,
			...req.body,
		} as User);

		return new SuccessResponse('Dentist profile updated', req.body).send(res);
	}),
);

export default router;
