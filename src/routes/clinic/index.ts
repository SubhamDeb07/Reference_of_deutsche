import express from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import _ from 'lodash';
import { ProtectedRequest } from 'app-request';
import { NotFoundResponse, SuccessResponse } from '../../core/ApiResponse';
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
import { RoleCode } from '../../database/Role/model';
import ClinicRepo from '../../database/Clinic/repo';
import UserRepo from '../../database/User/repo';
import RoleRepo from '../../database/Role/repo';
import User, { ApprovalStatus } from '../../database/User/model';
import { clinicEvent } from '../../events';
import moment from 'moment';
import { setPasswordMail } from '../../helpers/mail';
import { getJson } from '../../cache/query';
import { DynamicKey, getDynamicKey } from '../../cache/keys';
import Clinic, { Currency } from '../../database/Clinic/model';

const router = express.Router();

router.get(
	'/search',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.search, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundClinics = await ClinicRepo.search(
			(req.query.searchVal as string) ?? '',
			6,
		);

		return new SuccessResponse('Success', foundClinics).send(res);
	}),
);

router.get(
	'/:id',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.getById, ValidationSource.PARAM),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundClinic = await ClinicRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const exchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
		);

		let currency = 0;

		if (exchangeRates) {
			const value = exchangeRates[foundClinic.pricingPlan.currency];

			currency = Number(value);
		}

		foundClinic.dueAmount = foundClinic.dueAmount * Number(currency);
		foundClinic.paidAmount = foundClinic.paidAmount * Number(currency);

		foundClinic.pricingPlan.price = foundClinic.pricingPlan.price
			? foundClinic.pricingPlan.price * Number(currency)
			: 0;
		foundClinic.pricingPlan.simpleCasePrice = foundClinic.pricingPlan
			.simpleCasePrice
			? foundClinic.pricingPlan.simpleCasePrice * Number(currency)
			: 0;
		foundClinic.pricingPlan.moderateCasePrice = foundClinic.pricingPlan
			.moderateCasePrice
			? foundClinic.pricingPlan.moderateCasePrice * Number(currency)
			: 0;
		foundClinic.pricingPlan.complexCasePrice = foundClinic.pricingPlan
			.complexCasePrice
			? foundClinic.pricingPlan.complexCasePrice * Number(currency)
			: 0;

		return new SuccessResponse(
			'success',
			_.pick(foundClinic, [
				'_id',
				'name',
				'profilePicUrl',
				'email',
				'phoneNumber',
				'countryCode',
				'address',
				'isActive',
				'pricingPlan',
			]),
		).send(res);
	}),
);

router.post(
	'/',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.createClinic, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const randomPassword = Math.random().toString(36).slice(-8);
		const hashedPwd = randomPassword;

		const exchangeRates: any = await getJson(
			getDynamicKey(
				DynamicKey.EXCHANGE_RATES,
				req.body.clinic.pricingPlan.currency,
			),
		);

		let currency = 0;

		if (!exchangeRates) throw new BadRequestError('Currency not found');

		const value = exchangeRates[Currency.AED];

		currency = Number(value);

		const createdClinic = await ClinicRepo.createClinic(
			{
				...req.body.clinic,
				pricingPlan: {
					...req.body.clinic.pricingPlan,
					price: (req.body.clinic.pricingPlan.price || 0) * currency,
					simpleCasePrice:
						(req.body.clinic.pricingPlan.simpleCasePrice || 0) * currency,
					moderateCasePrice:
						(req.body.clinic.pricingPlan.moderateCasePrice || 0) * currency,
					complexCasePrice:
						(req.body.clinic.pricingPlan.complexCasePrice || 0) * currency,
				},
			},
			extractObjectId(req.user.lab),
		);

		req.body.dentist.email = req.body.dentist.email.toLowerCase();

		if (!createdClinic) throw new InternalError('Unable to create clinic');

		let createdDentistId: Types.ObjectId | null = null;

		try {
			req.body.dentist.approvalStatus = ApprovalStatus.APPROVED;
			req.body.dentist.isPermissionAdded = true;
			if (req.body.dentist.email) {
				const foundUser = await UserRepo.findByEmail(req.body.dentist.email);
				if (foundUser)
					throw new BadRequestError('This email is already in use');
			}

			const createdDentist = await UserRepo.create(
				req.body.dentist,
				RoleCode.DENTIST_ADMIN,
				extractObjectId(createdClinic.lab),
				createdClinic._id,
			);

			if (!createdDentist) {
				await ClinicRepo.deleteById(createdClinic._id);

				throw new InternalError('Unable to create dentist profile');
			}

			createdDentistId = createdDentist.user._id;
		} catch (error) {
			await ClinicRepo.deleteById(createdClinic._id);

			throw error;
		}

		// const verificationToken = {
		// 	token: bcrypt.hashSync(createdDentistId + Date.now().toString(), 10),
		// 	expiresAt: moment().add(90, 'days').toDate(),
		// };

		await UserRepo.updateInfo({
			_id: createdDentistId,
			privilege: {
				readPricing: true,
				createOrder: true,
				createDentist: true,
				updateClinic: true,
			},
			isPermissionAdded: true,
			password: hashedPwd,
		} as User);

		const passwordResetParams = {
			recipientEmail: req.body.dentist.email,
			token: randomPassword,
		};

		await setPasswordMail(
			passwordResetParams,
			req.body.dentist.name,
			req.body.clinic.name,
			'',
			'invitation',
			RoleCode.DENTIST,
		);

		return new SuccessResponse(
			'Success',
			_.pick(createdClinic, ['_id', 'name']),
		).send(res);
	}),
);

router.put(
	'/update/:id',
	authentication,
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN, RoleCode.DENTIST),
	authorization,
	validator(schema.updateClinic, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundClinic = await ClinicRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		if (!req.user.privilege.updateClinic)
			throw new ForbiddenError('Not allowed to update clinic');

		await ClinicRepo.update({
			_id: req.params.id,
			...req.body,
		});

		clinicEvent.onUpdateClinic(foundClinic._id, req.user._id);

		return new SuccessResponse('Clinic profile updated', req.body).send(res);
	}),
);

router.put(
	'/update/:id/price',
	authentication,
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.updatePricingPlan, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundClinic = await ClinicRepo.findById(
			new Types.ObjectId(req.params.id),
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const exchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, req.body.currency),
		);

		let currency = 0;

		if (!exchangeRates) throw new BadRequestError('Currency not found');

		const value = exchangeRates[Currency.AED];

		currency = Number(value);

		const updateObj = {
			_id: req.params.id as unknown as Types.ObjectId,
			pricingPlan: {
				type: req.body.type,
				currency: req.body.currency,
				price: (req.body.price || 0) * currency,
				simpleCasePrice: (req.body.simpleCasePrice || 0) * currency,
				moderateCasePrice: (req.body.moderateCasePrice || 0) * currency,
				complexCasePrice: (req.body.complexCasePrice || 0) * currency,
			},
		} as Clinic;

		await ClinicRepo.update(updateObj);

		return new SuccessResponse('Clinic profile updated', req.body).send(res);
	}),
);

router.get(
	'/:id/dueAmount',
	authentication,
	role(RoleCode.DENTIST_ADMIN, RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.search, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const foundClinic = await ClinicRepo.findFieldsById(
			new Types.ObjectId(req.params.id),
			'_id',
			'name',
			'dueAmount',
			'paidAmount',
			'pricingPlan',
		);

		if (!foundClinic) throw new NotFoundResponse('Clinic not found');

		const exchangeRates: any = await getJson(
			getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
		);

		let currency = 0;
		if (exchangeRates) {
			const value = exchangeRates[foundClinic.pricingPlan.currency];

			currency = Number(value);
		}

		foundClinic.dueAmount = foundClinic.dueAmount * Number(currency);
		foundClinic.paidAmount = foundClinic.paidAmount * Number(currency);

		foundClinic.pricingPlan.price =
			(foundClinic.pricingPlan.price || 0) * currency;
		foundClinic.pricingPlan.simpleCasePrice =
			(foundClinic.pricingPlan.simpleCasePrice || 0) * currency;
		foundClinic.pricingPlan.moderateCasePrice =
			(foundClinic.pricingPlan.moderateCasePrice || 0) * currency;
		foundClinic.pricingPlan.complexCasePrice =
			(foundClinic.pricingPlan.complexCasePrice || 0) * currency;

		return new SuccessResponse(
			'success',
			_.pick(foundClinic, [
				'_id',
				'name',
				'dueAmount',
				'paidAmount',
				'pricingPlan',
			]),
		).send(res);
	}),
);

router.get(
	'/',
	authentication,
	validator(schema.getByFilter, ValidationSource.QUERY),
	role(RoleCode.LAB_ADMIN),
	authorization,
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { searchVal = '', page = 1, limit = 1 } = req.query;

		const foundClinics = await ClinicRepo.findClinicWithSearch(
			(searchVal as string) || '',
			+page,
			+limit,
			extractObjectId(req.user.lab),
		);

		const response: any = [];

		for (const clinic of foundClinics[0]) {
			const exchangeRates: any = await getJson(
				getDynamicKey(DynamicKey.EXCHANGE_RATES, Currency.AED),
			);

			let currency = 0;

			if (!exchangeRates) throw new BadRequestError('Currency not found');

			const value = exchangeRates[clinic.pricingPlan.currency];

			currency = Number(value);

			response.push({
				...clinic,
				dueAmount: clinic.dueAmount * currency,
				paidAmount: clinic.paidAmount * currency,
				pricingPlan: {
					...clinic.pricingPlan,
					price: (clinic.pricingPlan.price || 0) * currency,
					simpleCasePrice: (clinic.pricingPlan.simpleCasePrice || 0) * currency,
					moderateCasePrice:
						(clinic.pricingPlan.moderateCasePrice || 0) * currency,
					complexCasePrice:
						(clinic.pricingPlan.complexCasePrice || 0) * currency,
				},
			});
		}

		return new SuccessResponse('Success', {
			clinics: response,
			count: foundClinics[1],
		}).send(res);
	}),
);

export default router;
