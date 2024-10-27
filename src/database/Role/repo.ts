import { Types } from 'mongoose';
import Role, { RoleModel } from './model';

async function findByCode(code: string): Promise<Role | null> {
	return RoleModel.findOne({ code: code }).lean().exec();
}

async function findByCodes(codes: string[]): Promise<Role[]> {
	return RoleModel.find({ code: { $in: codes } })
		.lean()
		.exec();
}

async function findFieldsById(
	id: Types.ObjectId,
	...fields: string[]
): Promise<Role | null> {
	return RoleModel.findById(id).select(fields).lean().exec();
}

export default {
	findByCode,
	findByCodes,
	findFieldsById,
};
