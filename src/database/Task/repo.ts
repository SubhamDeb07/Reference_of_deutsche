import { Types } from 'mongoose';
import Task, { TaskModel } from './model';

async function create(task: Task): Promise<Task> {
	const now = new Date();
	task.isFulfilled = false;
	task.createdAt = now;
	task.updatedAt = now;
	const created = await TaskModel.create(task);
	return created.toObject();
}

async function getUnFulfilled(): Promise<Task[]> {
	const endOfToday = new Date();
	endOfToday.setHours(23, 59, 59, 999);

	return TaskModel.find({
		dueDate: { $lt: endOfToday },
		isFulfilled: false,
	})
		.lean()
		.exec();
}

async function fulfill(taskId: Types.ObjectId): Promise<any> {
	return TaskModel.updateOne({ _id: taskId }, { isFulfilled: true })
		.lean()
		.exec();
}

export default {
	create,
	getUnFulfilled,
	fulfill,
};
