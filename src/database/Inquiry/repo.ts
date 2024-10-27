import Inquiry, {
	ImpressionStatus,
	ImpressionType,
	InquiryModel,
} from './model';
import { ProductType } from './types';
import ClinicRepo from '../Clinic/repo';
import UserRepo from '../User/repo';
import { Types } from 'mongoose';
import _ from 'lodash';
import { QuoteStatus } from '../Order/model';

async function getPatientInquires(
	patient: Types.ObjectId,
): Promise<Inquiry[] | []> {
	return InquiryModel.find({ patient })
		.populate({ path: 'order' })
		.populate({ path: 'treatmentPlanner', select: 'name' })
		.lean()
		.exec();
}

async function getByPatientAndProdType(
	patient: Types.ObjectId,
	prodType: ProductType,
): Promise<Inquiry | null> {
	return InquiryModel.findOne({ patient, prodType })
		.select(
			'_id archSide treatmentDetails order impressionStatus deliveryDetails treatmentPlanner quoteEstimationDate',
		)
		.lean()
		.exec();
}

async function getInquiryWithFilterPaginated(
	filter: string,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId,
	dentist: Types.ObjectId | null,
) {
	const findObj: any = {
		lab: labId,
		clinic: clinicId,
		$or: [],
	};

	// 'RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'
	if (filter === 'RECEIVED') {
		findObj.quoteStatus = QuoteStatus.ADMIN_APPROVED;
	}

	if (filter === 'IN_PROGRESS') {
		findObj.quoteStatus = {
			$in: [
				QuoteStatus.PENDING,
				QuoteStatus.REWORK,
				QuoteStatus.PENDING_APPROVAL,
			],
		};
	}

	if (filter === 'COMPLETED') {
		findObj.quoteStatus = QuoteStatus.DENTIST_APPROVED;
	}

	if (filter === 'CANCELED') {
		findObj.quoteStatus = QuoteStatus.DENTIST_CANCELED;
	}

	if (filter === 'IMPRESSION_PENDING') {
		findObj.impressionStatus = {
			$in: [ImpressionStatus.PENDING],
		};
	}

	if (dentist) findObj.dentist = dentist;

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];
		if (clinicId) {
			clinicIds = [clinicId];
		} else {
			const foundClinics = await ClinicRepo.search(searchQuery, 30);
			clinicIds = foundClinics.map((v) => v._id);

			if (!_.isEmpty(clinicIds)) {
				findObj.$or.push({
					clinic: {
						$in: clinicIds,
					},
				});
			}
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType order quoteStatus clinic dentist patient impressionType impressionStatus createdAt quoteEstimationDate',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic dentist patient order',
				select: '_id name profilePicUrl userId createdAt',
			})
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function getReviewsWithFilterPaginated(
	filter: string,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
) {
	const findObj: any = {
		lab: labId,
		$or: [],
		quoteStatus: {
			$neq: QuoteStatus.REWORK,
		},
	};

	if (filter === 'PENDING') {
		findObj.quoteStatus = QuoteStatus.PENDING;
	}

	if (filter === 'APPROVED') {
		findObj.quoteStatus = {
			$nin: [QuoteStatus.PENDING, QuoteStatus.REWORK],
		};
	}

	if (clinicId) findObj.clinic = clinicId;

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];
		if (clinicId) {
			clinicIds = [clinicId];
		} else {
			const foundClinics = await ClinicRepo.search(searchQuery, 30);
			clinicIds = foundClinics.map((v) => v._id);

			if (!_.isEmpty(clinicIds)) {
				findObj.$or.push({
					clinic: {
						$in: clinicIds,
					},
				});
			}
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType order quoteStatus clinic dentist patient impressionType impressionStatus createdAt',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic dentist patient',
				select: '_id name profilePicUrl userId',
			})
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function getInquiresWithFilterPaginated(
	filter: string,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
	sortField: string = 'quoteEstimationDate',
	sortOrder: string = 'desc',
) {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
	};

	switch (filter) {
		case 'NEW_INQUIRES':
			findObj.quoteStatus = QuoteStatus.PENDING;
			findObj.treatmentPlanner = null;
			break;
		case 'IN_PROGRESS':
			findObj.quoteStatus = { $in: [QuoteStatus.PENDING, QuoteStatus.REWORK] };
			findObj.treatmentPlanner = { $ne: null };
			break;
		case 'PENDING_APPROVAL':
			findObj.quoteStatus = QuoteStatus.PENDING_APPROVAL;
			break;
		case 'IMPRESSION_PENDING':
			findObj.impressionStatus = {
				$in: [ImpressionStatus.PENDING, ImpressionStatus.IN_PROGRESS],
			};
			break;
		case 'COMPLETED':
			findObj.quoteStatus = {
				$in: [
					QuoteStatus.ADMIN_APPROVED,
					QuoteStatus.DENTIST_APPROVED,
					QuoteStatus.DENTIST_REVIEWED,
					QuoteStatus.DENTIST_CANCELED,
				],
			};
			break;
		default:
			break;
	}

	if (clinicId) findObj.clinic = clinicId;

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];
		if (clinicId) {
			clinicIds = [clinicId];
		} else {
			const foundClinics = await ClinicRepo.search(searchQuery, 30);
			clinicIds = foundClinics.map((v) => v._id);

			if (!_.isEmpty(clinicIds)) {
				findObj.$or.push({
					clinic: {
						$in: clinicIds,
					},
				});
			}
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	const sortObj: { [key: string]: 1 | -1 } = {};
	sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType order clinic dentist patient impressionType impressionStatus quoteStatus quoteEstimationDate createdAt treatmentPlanner',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.sort(sortObj)
			.populate({
				path: 'clinic dentist patient treatmentPlanner',
				select: '_id name profilePicUrl quoteDetails userId address',
				populate: [
					{
						path: 'address.country',
						select: '_id name',
					},
				],
			})
			.populate({
				path: 'order',
				select: '_id name profilePicUrl quoteDetails userId',
			})

			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function getNewInquiresWithFilterPaginated(
	filter: string,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
) {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
		quoteStatus: QuoteStatus.PENDING,
		treatmentPlanner: {
			$eq: null,
		},
	};

	switch (filter) {
		case 'STL_IMPRESSION':
			findObj.impressionType = ImpressionType.SOFT_COPY;
			break;
		case 'PHYSICAL_IMPRESSION':
			findObj.impressionType = ImpressionType.PHYSICAL;
			break;
		default:
			break;
	}

	if (clinicId) findObj.clinic = clinicId;

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];
		if (clinicId) {
			clinicIds = [clinicId];
		} else {
			const foundClinics = await ClinicRepo.search(searchQuery, 30);
			clinicIds = foundClinics.map((v) => v._id);

			if (!_.isEmpty(clinicIds)) {
				findObj.$or.push({
					clinic: {
						$in: clinicIds,
					},
				});
			}
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType clinic dentist patient impressionType impressionStatus quoteStatus createdAt',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic dentist patient',
				select: '_id name profilePicUrl userId',
			})
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function getMyWithSearchFilterPaginated(
	filter: string,
	searchQuery: string,
	pageNumber: number,
	limit: number,
	labId: Types.ObjectId,
	plannerId: Types.ObjectId,
	clinicId: Types.ObjectId | null,
) {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		treatmentPlanner: plannerId,
		$or: [],
	};

	switch (filter) {
		case 'NEW_ASSIGNED':
			findObj.quoteStatus = QuoteStatus.PENDING;
			findObj.quoteEstimationDate = { $eq: null };
			break;
		case 'IN_PROGRESS':
			findObj.quoteEstimationDate = { $ne: null };
			findObj.quoteStatus = { $in: [QuoteStatus.PENDING, QuoteStatus.REWORK] };
			break;
		case 'PENDING_APPROVAL':
			findObj.quoteEstimationDate = { $ne: null };
			findObj.quoteStatus = QuoteStatus.PENDING_APPROVAL;
			break;
		case 'COMPLETED':
			findObj.quoteStatus = {
				$in: [
					QuoteStatus.ADMIN_APPROVED,
					QuoteStatus.DENTIST_APPROVED,
					QuoteStatus.DENTIST_CANCELED,
					QuoteStatus.DENTIST_REVIEWED,
				],
			};
		default:
			break;
	}

	if (clinicId) findObj.clinic = clinicId;

	if (searchQuery) {
		let clinicIds: Types.ObjectId[] = [];
		if (clinicId) {
			clinicIds = [clinicId];
		} else {
			const foundClinics = await ClinicRepo.search(searchQuery, 30);
			clinicIds = foundClinics.map((v) => v._id);

			if (!_.isEmpty(clinicIds)) {
				findObj.$or.push({
					clinic: {
						$in: clinicIds,
					},
				});
			}
		}

		const userIds = await UserRepo.search(searchQuery, 50, labId, clinicIds);
		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType clinic dentist patient impressionType impressionStatus quoteStatus quoteEstimationDate createdAt order',
			)
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.populate({
				path: 'clinic dentist patient order',
				select: '_id name profilePicUrl userId createdAt',
			})
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function findById(id: Types.ObjectId): Promise<Inquiry | null> {
	return InquiryModel.findOne({ _id: id })
		.select(
			'prodType order quoteStatus impressionType impressionStatus impressionFiles externalImages archSide patient lab clinic dentist treatmentDetails quoteEstimationDate treatmentPlanner deliveryDetails impressionRecievedBy',
		)
		.populate({
			path: 'patient clinic dentist order treatmentPlanner impressionRecievedBy',
			select:
				'_id name email profilePicUrl dob address phoneNumber countryCode gender quoteDetails userId pricingPlan',
		})
		.lean()
		.exec();
}

async function create(
	inquiry: Inquiry,
	labId: Types.ObjectId,
	clinicId: Types.ObjectId,
	dentist: Types.ObjectId,
): Promise<Inquiry> {
	const now = new Date();
	inquiry.createdAt = now;
	inquiry.updatedAt = now;
	inquiry.lab = labId;
	inquiry.clinic = clinicId;
	inquiry.dentist = dentist;
	inquiry.impressionStatus =
		inquiry.impressionType === ImpressionType.PHYSICAL
			? ImpressionStatus.PENDING
			: ImpressionStatus.NONE;
	const created = await InquiryModel.create(inquiry);
	return created.toObject();
}

async function update(inquiry: Inquiry): Promise<Inquiry | null> {
	inquiry.updatedAt = new Date();
	return InquiryModel.findByIdAndUpdate(inquiry._id, inquiry, { new: true })
		.lean()
		.exec();
}

async function findFieldsById(
	id: Types.ObjectId,
	...fields: string[]
): Promise<Inquiry | null> {
	return InquiryModel.findOne({ _id: id }, [...fields])
		.lean()
		.exec();
}

async function getImpressionInquires(
	filter: string,
	labId: Types.ObjectId,
	pageNumber: number,
	limit: number,
	searchQuery: string,
): Promise<[Inquiry[], number]> {
	const findObj: any = {
		lab: labId,
		isDeleted: false,
		$or: [],
	};

	switch (filter) {
		case 'PENDING':
			findObj.impressionStatus = ImpressionStatus.PENDING;
			break;
		case 'IN_PROGRESS':
			findObj.impressionStatus = ImpressionStatus.IN_PROGRESS;
			break;
		case 'DELIVERED':
			findObj.impressionStatus = ImpressionStatus.DELIVERED;
			break;
		default:
			break;
	}
	if (searchQuery) {
		const startingLetters = searchQuery.slice(0, 4);
		const restOfQuery = searchQuery.slice(4);
		const regex = new RegExp(`^${startingLetters}${restOfQuery}`, 'i');

		const userSearchQuery = {
			$or: [
				{ name: { $regex: regex } },
				{ email: { $regex: regex } },
				{ userId: { $regex: regex } },
			],
			lab: labId,
		};

		const userIds = await UserRepo.findByFieldsWithPagination(
			userSearchQuery,
			1,
			50,
		);

		if (!_.isEmpty(userIds)) {
			findObj.$or.push({
				dentist: {
					$in: userIds.map((e) => e._id),
				},
			});
			findObj.$or.push({
				patient: {
					$in: userIds.map((e) => e._id),
				},
			});
		}
	}

	if (_.isEmpty(findObj.$or)) {
		delete findObj.$or;

		if (!_.isEmpty(searchQuery)) {
			return Promise.resolve([[], 0]);
		}
	}

	return Promise.all([
		InquiryModel.find(findObj)
			.select(
				'_id prodType order clinic dentist patient impressionStatus impressionRecievedBy',
			)
			.populate({
				path: 'clinic dentist patient impressionRecievedBy',
				select: '_id name profilePicUrl userId address',
				populate: {
					path: 'address.country',
					select: '_id name',
				},
			})
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function treatmentPlans(
	clinicId: Types.ObjectId,
	dentistId: Types.ObjectId | null,
	filter: string,
	pageNumber: number,
	limit: number,
): Promise<[Inquiry[], number]> {
	const findObj: any = {
		prodType: filter,
		clinic: clinicId,
		isDeleted: false,
	};

	if (dentistId) findObj.dentist = dentistId;

	return Promise.all([
		InquiryModel.find(findObj)
			.select('_id prodType patient clinic dentist')
			.populate({
				path: 'patient',
				select: '_id name profilePicUrl',
			})
			.limit(limit)
			.skip(limit * (pageNumber - 1))
			.lean()
			.exec(),
		InquiryModel.countDocuments(findObj),
	]);
}

async function updateById(id: Types.ObjectId, inquires: Inquiry): Promise<any> {
	inquires.updatedAt = new Date();
	return InquiryModel.updateOne({ _id: id }, { $set: { ...inquires } })
		.lean()
		.exec();
}

async function getDeletedInquiries(
	pageNumber: number,
	limit: number,
): Promise<[Inquiry[], number]> {
	return Promise.all([
		InquiryModel.find({ isDeleted: true })
			.select(
				'_id prodType patient clinic dentist isDeleted creaedAt updatedAt',
			)
			.populate({
				path: 'patient clinic dentist',
				select: '_id name userId profilePicUrl',
			})
			.skip(limit * (pageNumber - 1))
			.limit(limit)
			.exec(),
		InquiryModel.countDocuments({ isDeleted: true }),
	]);
}

export default {
	getPatientInquires,
	getByPatientAndProdType,
	getInquiryWithFilterPaginated,
	getReviewsWithFilterPaginated,
	getInquiresWithFilterPaginated,
	getNewInquiresWithFilterPaginated,
	getMyWithSearchFilterPaginated,
	findById,
	findFieldsById,
	create,
	update,
	getImpressionInquires,
	treatmentPlans,
	updateById,
	getDeletedInquiries,
};
