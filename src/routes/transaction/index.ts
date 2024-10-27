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
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import { RoleCode } from '../../database/Role/model';
import ClinicRepo from '../../database/Clinic/repo';
import Clinic, { Currency } from '../../database/Clinic/model';
import RoleRepo from '../../database/Role/repo';
import TransactionRepo from '../../database/Transactions/repo';
import schema from './schema';
import { clinicEvent } from '../../events';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
import { getJson } from '../../cache/query';
import { DynamicKey, getDynamicKey } from '../../cache/keys';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.post(
	'/',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.createTransaction, ValidationSource.BODY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { amount, type, clinic } = req.body;

		if (typeof amount !== 'number')
			throw new BadRequestError('Amount must be a number');

		const foundClinic = await ClinicRepo.findFieldsById(
			clinic,
			'dueAmount',
			'paidAmount',
			'pricingPlan',
		);

		if (!foundClinic) throw new BadRequestError('Clinic not found');

		const cachedExchangeRates: any = await getJson(
			getDynamicKey(
				DynamicKey.EXCHANGE_RATES,
				foundClinic.pricingPlan.currency,
			),
		);

		let currency = 0;

		if (cachedExchangeRates) {
			const value = cachedExchangeRates[Currency.AED];

			currency = Number(value);
		}

		const convertedAmount = amount * currency;

		const balanceAmount = foundClinic.dueAmount - foundClinic.paidAmount;

		if (Math.round(balanceAmount) < Math.round(convertedAmount)) {
			throw new BadRequestError('Payment exceeds the due amount.');
		}

		const paidAmount = foundClinic.paidAmount + convertedAmount;

		const transaction = await TransactionRepo.create(
			convertedAmount,
			type,
			clinic,
			extractObjectId(req.user.lab),
		);

		await ClinicRepo.update({
			_id: clinic,
			paidAmount,
		} as Clinic);

		clinicEvent.onUpdateBalance(clinic);

		new SuccessResponse('Transaction created successfully', transaction).send(
			res,
		);
	}),
);

router.get(
	'/clinics',
	role(RoleCode.LAB_ADMIN),
	authorization,
	validator(schema.getClinicsWithFilter, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const {
			searchQuery = '',
			page = 1,
			limit = 1,
			filter = 'PENDING',
		} = req.query;

		const foundClinics = await TransactionRepo.getAllClinicsWithFilter(
			(searchQuery as string) || '',
			+page,
			+limit,
			extractObjectId(req.user.lab),
			filter as 'PENDING' | 'COMPLETED',
		);

		const response: any = [];

		for (const clinic of foundClinics[0].clinics) {
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
			count: foundClinics[0].count[0]?.count || 0,
		}).send(res);
	}),
);

router.get(
	'/:id',
	role(RoleCode.LAB_ADMIN, RoleCode.DENTIST_ADMIN),
	authorization,
	validator(schema.getByFilter, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { page = 1, limit = 1, searchQuery = '' } = req.query;

		const foundClinic = await ClinicRepo.findFieldsById(
			new Types.ObjectId(req.params.id),
			'_id',
			'pricingPlan',
		);

		if (!foundClinic) throw new NotFoundError('Clinic not found');

		const transactions = await TransactionRepo.getTransactions(
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

		const response: any = transactions[0].map((transaction) => ({
			...transaction,
			amount: transaction.amount * currency,
			currency: foundClinic.pricingPlan.currency,
		}));

		new SuccessResponse('Transactions fetched successfully', {
			data: response,
			count: transactions[1],
		}).send(res);
	}),
);

export default router;
