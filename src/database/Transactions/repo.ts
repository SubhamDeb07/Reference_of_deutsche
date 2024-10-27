import User, { UserModel } from '../User/model';
import Order from '../Order/model';
import Transaction, { PaymentMode, TransactionModel } from './model';
import ClinicRepo from '../Clinic/repo';
import Role, { RoleCode } from '../Role/model';
import { InternalError } from '../../core/ApiError';
import { Types } from 'mongoose';
import _ from 'lodash';
import Clinic, { ClinicModel } from '../Clinic/model';

async function create(
	amount: number,
	paymentMode: PaymentMode,
	clinicId: Types.ObjectId,
	labId: Types.ObjectId,
): Promise<Transaction> {
	const now = new Date();
	const transaction = {
		clinic: clinicId,
		lab: labId,
		amount,
		paymentMode,
		createdAt: now,
		updatedAt: now,
	} as Transaction;

	const createdTransaction = await TransactionModel.create(transaction);
	return createdTransaction.toObject();
}

async function getTransactions(
	id: Types.ObjectId,
	clinicId: Types.ObjectId,
	pageNumber: number,
	limit: number,
	searchQuery: string,
): Promise<[Transaction[], number]> {
	const findObj: any = {
		clinic: clinicId,
		lab: id,
	};

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];

		const foundClinics = await ClinicRepo.search(searchQuery, 30);
		clinicIds = foundClinics.map((v) => v._id);

		if (_.isEmpty(clinicIds)) {
			return [[], 0];
		}

		findObj.clinic = {
			$in: clinicIds,
		};
	}

	return Promise.all([
		TransactionModel.find(findObj)
			.skip((pageNumber - 1) * limit)
			.limit(limit)
			.lean()
			.exec(),
		TransactionModel.countDocuments(findObj).exec(),
	]);
}

async function getAllClinicsWithFilter(
	query: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	filter: 'PENDING' | 'COMPLETED',
): Promise<{ clinics: Clinic[]; count: [{ count: number }] }[]> {
	const findObj: any = {
		lab: labId,
	};

	const filterObj: any = {};

	if (filter === 'PENDING') {
		filterObj.balanceAmount = { $gt: 0 };
	}

	if (filter === 'COMPLETED') {
		filterObj.paidAmount = { $gt: 0 };
	}

	if (query.length > 0) {
		const startingLetters = query.slice(0, 4);
		const restOfQuery = query.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}

	return ClinicModel.aggregate([
		{
			$match: findObj,
		},
		{
			$addFields: {
				balanceAmount: {
					$subtract: ['$dueAmount', '$paidAmount'],
				},
			},
		},
		{
			$match: filterObj,
		},
		{
			$facet: {
				clinics: [
					{ $skip: (pageNumber - 1) * limit },
					{ $limit: limit },
					{
						$lookup: {
							from: TransactionModel.collection.name,
							let: { clinicId: '$_id' },
							pipeline: [
								{
									$match: {
										$expr: {
											$eq: ['$clinic', '$$clinicId'],
										},
									},
								},
								{
									$sort: { createdAt: -1 },
								},
								{
									$limit: 1,
								},
								{
									$project: {
										createdAt: 1,
									},
								},
							],
							as: 'transaction',
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							profilePicUrl: 1,
							email: 1,
							phoneNumber: 1,
							countryCode: 1,
							lab: 1,
							address: 1,
							shipmentMethod: 1,
							pricingPlan: 1,
							isActive: 1,
							dueAmount: 1,
							paidAmount: 1,
							createdAt: 1,
							updatedAt: 1,
							balanceAmount: 1,
							transaction: { $arrayElemAt: ['$transaction', 0] },
						},
					},
				],
				count: [{ $count: 'count' }],
			},
		},
	]);
}

export default { create, getTransactions, getAllClinicsWithFilter };
