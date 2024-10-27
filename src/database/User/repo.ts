import User, { ApprovalStatus, UserModel } from './model';
import { RoleCode } from '../Role/model';
import { InternalError } from '../../core/ApiError';
import { Types } from 'mongoose';
import KeystoreRepo from '../KeyStore/repo';
import Keystore from '../KeyStore/model';
import RoleRepo from '../Role/repo';
import _ from 'lodash';
import Order from '../Order/model';
import { ProductType } from '../Inquiry/types';

async function exists(id: Types.ObjectId): Promise<boolean> {
	const user = await UserModel.exists({ _id: id });
	return user !== null && user !== undefined;
}

async function findPrivateProfileById(
	id: Types.ObjectId,
): Promise<User | null> {
	return UserModel.findOne({ _id: id })
		.select('+email +userId')
		.populate({ path: 'address.country address.city', select: 'name _id' })
		.populate({
			path: 'role',
			match: { status: true },
			select: { code: 1 },
		})
		.lean<User>()
		.exec();
}

// contains critical information of the user
async function findById(id: Types.ObjectId): Promise<User | null> {
	return UserModel.findOne({ _id: id })
		.select('+email +password +role +userId')
		.populate({
			path: 'role',
			match: { status: true },
		})
		.lean()
		.exec();
}

async function findByFields(fields: any): Promise<User | null> {
	return UserModel.findOne(fields).select('+email +role +userId').lean().exec();
}

async function findByFieldsWithPagination(
	fields: any,
	page: number,
	limit: number,
): Promise<User[] | []> {
	return UserModel.find(fields)
		.select('+email +role +userId')
		.limit(limit)
		.skip(limit * (page - 1))
		.lean()
		.exec();
}

async function findByEmail(email: string): Promise<User | null> {
	return UserModel.findOne({ email: email })
		.select(
			'+email +password +role +privilege +gender +dob +grade +country +state +city +school +bio +hobbies +isActive +approvalStatus +isPermissionAdded +userId +lab',
		)
		.populate({
			path: 'role',
			match: { status: true },
			select: { code: 1 },
		})
		.populate({
			path: 'lab',
			select: { isImpressionRequired: 1 },
		})
		.lean()
		.exec();
}

async function findByVerificationToken(token: string): Promise<User | null> {
	return UserModel.findOne({ 'verificationToken.token': token })
		.select('_id verificationToken userId')
		.lean()
		.exec();
}

async function findFieldsById(
	id: Types.ObjectId,
	...fields: string[]
): Promise<User | null> {
	return UserModel.findOne({ _id: id }, [...fields])
		.lean()
		.exec();
}

async function findPublicProfileById(id: Types.ObjectId): Promise<User | null> {
	return UserModel.findOne({ _id: id })
		.select(
			'_id profilePicUrl approvalStatus email name phoneNumber countryCode gender address clinic privilege isActive userId role password',
		)
		.populate({ path: 'address.country address.city', select: 'name _id' })
		.populate({ path: 'role', select: 'code' })
		.lean()
		.exec();
}

async function create(
	user: User,
	roleCode: RoleCode,
	labId: Types.ObjectId,
	clinicId?: Types.ObjectId,
): Promise<{ user: User }> {
	const now = new Date();

	const role = await RoleRepo.findByCode(roleCode);
	if (!role) throw new InternalError('No Role found');

	if (user.email) user.email = user.email.toLowerCase();

	user.role = role;
	user.lab = labId;
	user.clinic = clinicId;
	user.createdAt = user.updatedAt = now;
	const createdUser = await UserModel.create(user);

	return {
		user: { ...createdUser.toObject(), role: user.role },
	};
}

async function update(
	user: User,
	accessTokenKey: string,
	refreshTokenKey: string,
): Promise<{ user: User; keystore: Keystore }> {
	user.updatedAt = new Date();

	if (user.email) user.email = user.email.toLowerCase();

	await UserModel.updateOne({ _id: user._id }, { $set: { ...user } })
		.lean()
		.exec();

	const keystore = await KeystoreRepo.create(
		user,
		accessTokenKey,
		refreshTokenKey,
	);

	return { user: user, keystore: keystore };
}

async function updateInfo(user: User): Promise<any> {
	if (user.email) user.email = user.email.toLowerCase();
	user.updatedAt = new Date();
	return UserModel.updateOne({ _id: user._id }, { $set: { ...user } })
		.lean()
		.exec();
}

async function deleteById(userId: Types.ObjectId) {
	return UserModel.deleteOne({ _id: userId }).exec();
}

async function search(
	query: string,
	limit: number,
	labId: Types.ObjectId,
	clinicIds: Types.ObjectId[],
): Promise<User[]> {
	const findQuery: any = {
		lab: labId,
	};
	if (query.length > 0) {
		const startingLetters = query.slice(0, 4);
		const restOfQuery = query.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findQuery['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}

	if (!_.isEmpty(clinicIds)) findQuery.clinic = { $in: clinicIds };

	return UserModel.find(findQuery)
		.select('_id name email profilePicUrl patient userId')
		.limit(limit)
		.lean()
		.exec();
}

async function searchPatient(query: string, clinicId: Types.ObjectId) {
	const role = await RoleRepo.findByCode(RoleCode.PATIENT);
	if (!role) throw new InternalError('No Role found');

	const findObj: any = {
		clinic: clinicId,
		role: new Types.ObjectId(role?._id),
	};
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

	return UserModel.aggregate([
		{
			$match: findObj,
		},
		{ $limit: 10 },
		{ $sort: { name: 1 } },
		{
			$lookup: {
				from: 'orders',
				localField: '_id',
				foreignField: 'patient',
				as: 'orders',
			},
		},
		{
			$unwind: {
				path: '$orders',
				preserveNullAndEmptyArrays: true,
			},
		},

		{
			$lookup: {
				from: 'inquiries',
				localField: '_id',
				foreignField: 'patient',
				as: 'inquiries',
			},
		},
		{
			$project: {
				_id: 1,
				name: 1,
				email: 1,
				profilePicUrl: 1,
				userId: 1,
				orders: 1,
				inquiries: 1,
			},
		},
	]);
}

async function searchPatientInLab(query: string, labId: Types.ObjectId) {
	const role = await RoleRepo.findByCode(RoleCode.PATIENT);

	if (!role) throw new InternalError('No Role found');

	const findObj: any = {
		lab: labId,
		role: new Types.ObjectId(role?._id),
	};

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

	return UserModel.aggregate([
		{ $match: findObj },
		{ $limit: 10 },
		{ $sort: { name: 1 } },
		{
			$lookup: {
				from: 'orders',
				localField: '_id',
				foreignField: 'patient',
				as: 'orders',
			},
		},
		{
			$unwind: {
				path: '$orders',
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: 'inquiries',
				localField: '_id',
				foreignField: 'patient',
				as: 'inquiries',
			},
		},
		{
			$project: {
				_id: 1,
				name: 1,
				email: 1,
				profilePicUrl: 1,
				userId: 1,
				orders: 1,
				inquiries: 1,
			},
		},
	]).exec();
}

async function getDentistsWithFilterPaginated(
	pageNumber: number,
	limit: number,
	loggedInUserId: Types.ObjectId,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
	approvalStatus: string,
	searchQuery: string,
) {
	const roles = await RoleRepo.findByCodes([
		RoleCode.DENTIST_ADMIN,
		RoleCode.DENTIST,
	]);

	const findObj: any = {
		lab: labId,
		_id: { $ne: loggedInUserId },
		role: { $in: roles },
	};

	if (searchQuery.length > 0) {
		const startingLetters = searchQuery.slice(0, 3);
		const restOfQuery = searchQuery.slice(3);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}

	if (approvalStatus != 'ALL') {
		findObj.approvalStatus = approvalStatus;
	}

	if (clinicId) findObj.clinic = clinicId;

	return Promise.all([
		UserModel.find(findObj)
			.select(
				'_id name isActive profilePicUrl email phoneNumber countryCode clinic address userId',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic address.country address.city',
				select: '_id name profilePicUrl',
			})
			.lean()
			.exec(),
		UserModel.countDocuments(findObj),
	]);
}

async function getApprovalDentistsWithFilterPaginated(
	pageNumber: number,
	limit: number,
	loggedInUserId: Types.ObjectId,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
	approvalStatus: string,
	searchQuery: string,
) {
	const roles = await RoleRepo.findByCodes([RoleCode.DENTIST]);

	const findObj: any = {
		lab: labId,
		_id: { $ne: loggedInUserId },
		role: { $in: roles },
	};

	if (searchQuery.length > 0) {
		const startingLetters = searchQuery.slice(0, 3);
		const restOfQuery = searchQuery.slice(3);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}

	if (approvalStatus != 'ALL') {
		findObj.approvalStatus = approvalStatus;
	} else {
		findObj.approvalStatus = {
			$in: [ApprovalStatus.PENDING, ApprovalStatus.REJECTED],
		};
	}

	if (clinicId) findObj.clinic = clinicId;

	return Promise.all([
		UserModel.find(findObj)
			.select(
				'_id name isActive profilePicUrl email phoneNumber countryCode clinic address userId',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic address.country address.city',
				select: '_id name profilePicUrl',
			})
			.lean()
			.exec(),
		UserModel.countDocuments(findObj),
	]);
}

async function findPatientsByDentist(
	id: Types.ObjectId,
	searchQuery: string,
	pageNumber: number,
	limit: number,
): Promise<[UserWithOrders[], number]> {
	const patientRole = await RoleRepo.findByCode(RoleCode.PATIENT);

	const findObj: any = {
		dentist: new Types.ObjectId(id),
		role: new Types.ObjectId(patientRole?._id),
	};

	if (searchQuery.length > 0) {
		const startingLetters = searchQuery.slice(0, 4);
		const restOfQuery = searchQuery.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}
	return Promise.all([
		UserModel.aggregate([
			{
				$match: findObj,
			},
			{
				$skip: limit * (pageNumber - 1),
			},
			{
				$limit: limit,
			},
			{
				$lookup: {
					from: 'orders',
					localField: '_id',
					foreignField: 'patient',
					as: 'orders',
				},
			},
			{
				$lookup: {
					from: 'inquiries',
					let: { patientId: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$patient', '$$patientId'] },
										{ $eq: ['$prodType', ProductType.ALIGNER] },
									],
								},
							},
						},
						{
							$project: {
								createdAt: 1,
								treatmentPlanner: 1,
								_id: 0,
							},
						},
					],
					as: 'inquiries',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { treatmentPlannerId: '$inquiries.treatmentPlanner' },
					pipeline: [
						{
							$match: {
								$expr: { $in: ['$_id', '$$treatmentPlannerId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
							},
						},
					],
					as: 'treatmentPlanner',
				},
			},
			{
				$project: {
					_id: 1,
					name: 1,
					email: 1,
					profilePicUrl: 1,
					userId: 1,
					orders: 1,
					inquiries: { $arrayElemAt: ['$inquiries', 0] },
					treatmentPlanner: { $arrayElemAt: ['$treatmentPlanner', 0] },
				},
			},
		]),
		UserModel.countDocuments(findObj),
	]);
}

interface UserWithOrders extends User {
	orders: Order[];
}

async function findPatientsByClinic(
	clinicId: Types.ObjectId,
	searchQuery: string,
	pageNumber: number,
	limit: number,
): Promise<[UserWithOrders[], number]> {
	const patientRole = await RoleRepo.findByCode(RoleCode.PATIENT);

	const findObj: any = {
		clinic: new Types.ObjectId(clinicId),
		role: new Types.ObjectId(patientRole?._id),
	};

	if (searchQuery.length > 0) {
		const startingLetters = searchQuery.slice(0, 4);
		const restOfQuery = searchQuery.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}
	return Promise.all([
		UserModel.aggregate([
			{
				$match: findObj,
			},
			{
				$skip: limit * (pageNumber - 1),
			},
			{
				$limit: limit,
			},
			{
				$lookup: {
					from: 'orders',
					localField: '_id',
					foreignField: 'patient',
					as: 'orders',
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
					let: { patientId: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$patient', '$$patientId'] },
										{ $eq: ['$prodType', ProductType.ALIGNER] },
									],
								},
							},
						},

						{
							$project: {
								createdAt: 1,
								treatmentPlanner: 1,
								_id: 0,
							},
						},
					],
					as: 'inquiries',
				},
			},
			{
				$lookup: {
					from: 'users',
					let: { treatmentPlannerId: '$inquiries.treatmentPlanner' },
					pipeline: [
						{
							$match: {
								$expr: { $in: ['$_id', '$$treatmentPlannerId'] },
							},
						},
						{
							$project: {
								_id: 1,
								name: 1,
							},
						},
					],
					as: 'treatmentPlanner',
				},
			},
			{
				$project: {
					_id: 1,
					name: 1,
					email: 1,
					dentist: { $arrayElemAt: ['$dentist', 0] },
					userId: 1,
					profilePicUrl: 1,
					orders: 1,
					inquiries: { $arrayElemAt: ['$inquiries', 0] },
					treatmentPlanner: { $arrayElemAt: ['$treatmentPlanner', 0] },
				},
			},
		]),
		UserModel.countDocuments(findObj),
	]);
}

async function getLabUsersWithSearch(
	labId: Types.ObjectId,
	searchQuery: string,
	role: string,
	pageNumber: number,
	limit: number,
) {
	let roles: Types.ObjectId[] = [];

	if (role === 'ALL') {
		const treatmentPlanner = await RoleRepo.findByCode(
			RoleCode.TREATMENT_PLANNER,
		);
		const productionManager = await RoleRepo.findByCode(
			RoleCode.PRODUCTION_MANAGER,
		);
		const deliveryCoordinator = await RoleRepo.findByCode(
			RoleCode.DELIVERY_COORDINATOR,
		);

		roles = [
			treatmentPlanner?._id as Types.ObjectId,
			productionManager?._id as Types.ObjectId,
			deliveryCoordinator?._id as Types.ObjectId,
		];
	} else {
		const foundRole = await RoleRepo.findByCode(role);
		roles = [foundRole?._id as Types.ObjectId];
	}

	const findObj: any = {
		lab: labId,
		role: {
			$in: roles,
		},
	};

	if (searchQuery.length > 0) {
		const startingLetters = searchQuery.slice(0, 4);
		const restOfQuery = searchQuery.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');
		findObj['$or'] = [
			{ name: { $regex: regex } },
			{ email: { $regex: regex } },
			{ userId: { $regex: regex } },
		];
	}

	return Promise.all([
		UserModel.find(findObj)
			.select(
				'_id name profilePicUrl email phoneNumber countryCode role userId isActive password',
			)
			.populate({
				path: 'role',
			})
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.sort({ name: 1 })
			.lean()
			.exec(),
		UserModel.countDocuments(findObj),
	]);
}

async function getPatientByUserId(
	id: string,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
): Promise<User | null> {
	const role = await RoleRepo.findByCode(RoleCode.PATIENT);

	const findObj: any = {
		userId: id,
		role,
		lab: labId,
	};

	if (clinicId) findObj.clinic = clinicId;

	return UserModel.findOne(findObj).lean().exec();
}

async function getAllDentistAdmins(
	labId: Types.ObjectId,
	clinicId: Types.ObjectId,
): Promise<User[] | []> {
	const dentistAdminRole = await RoleRepo.findByCode(RoleCode.DENTIST_ADMIN);

	return UserModel.find({
		lab: labId,
		clinic: clinicId,
		role: dentistAdminRole,
	})
		.select('_id name email phoneNumber countryCode profilePicUrl')
		.lean()
		.exec();
}

async function getAllLabAdmins(labId: Types.ObjectId): Promise<User[] | []> {
	const labAdminRole = await RoleRepo.findByCode(RoleCode.LAB_ADMIN);

	return UserModel.find({
		lab: labId,
		role: labAdminRole,
	})
		.select('_id name email phoneNumber countryCode profilePicUrl')
		.lean()
		.exec();
}

async function getAllLabDeliveryCoordinators(
	labId: Types.ObjectId,
): Promise<User[] | []> {
	const deliveryCoordinatorRole = await RoleRepo.findByCode(
		RoleCode.DELIVERY_COORDINATOR,
	);

	return UserModel.find({
		lab: labId,
		role: deliveryCoordinatorRole,
	})
		.select('_id name email phoneNumber countryCode profilePicUrl')
		.lean()
		.exec();
}

function getAllUserIdsByLab(labId: Types.ObjectId): Promise<User[] | []> {
	return UserModel.find({ lab: labId }).select('_id').lean().exec();
}

export default {
	exists,
	search,
	searchPatient,
	getAllUserIdsByLab,
	searchPatientInLab,
	findPrivateProfileById,
	findById,
	findByEmail,
	findByVerificationToken,
	findFieldsById,
	findPublicProfileById,
	create,
	update,
	updateInfo,
	deleteById,
	getDentistsWithFilterPaginated,
	getApprovalDentistsWithFilterPaginated,
	getLabUsersWithSearch,
	findPatientsByDentist,
	getPatientByUserId,
	getAllDentistAdmins,
	getAllLabAdmins,
	getAllLabDeliveryCoordinators,
	findPatientsByClinic,
	findByFields,
	findByFieldsWithPagination,
};
