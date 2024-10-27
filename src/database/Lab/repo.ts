import Lab, { LabModel } from './model';
import { Types } from 'mongoose';

async function getAllPaginated(
	pageNumber: number,
	limit: number,
): Promise<Lab[] | []> {
	return LabModel.find({})
		.select('_id name')
		.skip(limit * (pageNumber - 1))
		.limit(limit)
		.lean()
		.exec();
}

async function findById(id: Types.ObjectId): Promise<Lab | null> {
	return LabModel.findOne({ _id: id }).lean().exec();
}

async function findFieldsById(id: Types.ObjectId, ...fields: string[]) {
	return LabModel.findOne({ _id: id })
		.select([...fields])
		.lean()
		.exec();
}

async function create(labData: Lab): Promise<Lab> {
	const now = new Date();
	labData.createdAt = now;
	labData.updatedAt = now;
	const created = await LabModel.create(labData);
	return created.toObject();
}

async function update(labData: Lab): Promise<Lab | null> {
	labData.updatedAt = new Date();
	return LabModel.findByIdAndUpdate(labData._id, labData, { new: true })
		.lean()
		.exec();
}

export default {
	getAllPaginated,
	findById,
	findFieldsById,
	create,
	update,
};
