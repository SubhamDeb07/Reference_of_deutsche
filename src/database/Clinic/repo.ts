import Clinic, { ClinicModel } from './model';
import { Types } from 'mongoose';
import { TransactionModel } from '../Transactions/model';

async function search(query: string, limit: number): Promise<Clinic[]> {
	const findObj: any = {};
	if (query.length > 0) {
		const startingLetters = query.slice(0, 4);
		const restOfQuery = query.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
		];
	}
	return ClinicModel.find(findObj)
		.select('_id name email profilePicUrl')
		.limit(limit)
		.lean()
		.exec();
}

async function findById(id: Types.ObjectId): Promise<Clinic | null> {
	return ClinicModel.findOne({ _id: id })
		.populate({ path: 'address.city address.country', select: 'name _id' })
		.lean()
		.exec();
}

async function findFieldsById(
	id: Types.ObjectId,
	...fields: string[]
): Promise<Clinic | null> {
	return ClinicModel.findOne({ _id: id }, [...fields])
		.lean()
		.exec();
}

async function createClinic(
	clinic: Clinic,
	labId: Types.ObjectId,
): Promise<Clinic> {
	if (clinic.email) clinic.email = clinic.email.toLowerCase();

	const now = new Date();
	clinic.createdAt = now;
	clinic.updatedAt = now;
	clinic.lab = labId;
	const created = await ClinicModel.create(clinic);
	return created.toObject();
}

async function update(clinic: Clinic): Promise<Clinic | null> {
	clinic.updatedAt = new Date();

	if (clinic.email) clinic.email = clinic.email.toLowerCase();

	return ClinicModel.findByIdAndUpdate(clinic._id, clinic, { new: true })
		.lean()
		.exec();
}

async function deleteById(id: Types.ObjectId) {
	return ClinicModel.deleteOne({ _id: id }).exec();
}

async function findClinicWithSearch(
	query: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
): Promise<[Clinic[], number]> {
	const findObj: any = { lab: labId };

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

	return Promise.all([
		ClinicModel.aggregate([
			{
				$match: findObj,
			},
			{
				$sort: { name: 1 },
			},
			{
				$skip: (pageNumber - 1) * limit,
			},
			{
				$limit: limit,
			},
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
				$lookup: {
					from: 'users',
					let: { clinicId: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{
											$eq: ['$clinic', '$$clinicId'],
										},
										{
											$eq: ['$isActive', true],
										},
									],
								},
							},
						},
						{
							$count: 'userCount',
						},
					],
					as: 'users',
				},
			},
			{
				$project: {
					_id: 1,
					name: 1,
					email: 1,
					profilePicUrl: 1,
					paidAmount: 1,
					dueAmount: 1,
					isActive: 1,
					phoneNumber: 1,
					countryCode: 1,
					pricingPlan: 1,
					transaction: { $arrayElemAt: ['$transaction', 0] },
					activeUsers: { $first: '$users.userCount' },
				},
			},
		]),
		ClinicModel.countDocuments(findObj),
	]);
}

export default {
	findById,
	findFieldsById,
	search,
	deleteById,
	createClinic,
	update,
	findClinicWithSearch,
};
