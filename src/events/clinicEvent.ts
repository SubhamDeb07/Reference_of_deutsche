import EventEmitter from 'events';
import { Types } from 'mongoose';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { notificationQueue } from '../queues';
import UserRepo from '../database/User/repo';
import RoleRepo from '../database/Role/repo';
import TaskRepo from '../database/Task/repo';
import ClinicRepo from '../database/Clinic/repo';
import { extractObjectId } from '../helpers/validator';
import User from '../database/User/model';
import { RoleCode } from '../database/Role/model';
import { TaskType } from '../database/Task/model';
import Logger from '../core/Logger';
import TemplateManager, {
	TemplateName,
	TemplateType,
} from '../helpers/templateManager';

const templateManager = new TemplateManager();

const eventEmitter = new EventEmitter();

function onCreateClinic(clinicId: Types.ObjectId) {
	eventEmitter.emit('createClinic', clinicId);
}

eventEmitter.on('createClinic', async (clinicId: Types.ObjectId) => {
	try {
		const foundClinic = await ClinicRepo.findFieldsById(clinicId, 'lab');

		if (!foundClinic) return;

		await TaskRepo.create({
			_id: new Types.ObjectId(),
			type: TaskType.DUE_PAYMENT,
			details: { clinic: clinicId },
			dueDate: new Date(),
			isFulfilled: false,
		});
	} catch (err) {
		Logger.error(err);
	}
});

function onUpdateClinic(clinicId: Types.ObjectId, updatedById: Types.ObjectId) {
	eventEmitter.emit('updateClinic', clinicId, updatedById);
}

eventEmitter.on(
	'updateClinic',
	async (clinicId: Types.ObjectId, updatedById: Types.ObjectId) => {
		try {
			const foundUser = await UserRepo.findFieldsById(
				updatedById,
				'role',
				'lab',
				'name',
			);

			const foundAdminRole = await RoleRepo.findByCode(RoleCode.DENTIST_ADMIN);

			if (!foundUser || !foundAdminRole) return;

			if (foundUser.role.toString() !== foundAdminRole._id.toString()) return;

			const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
				extractObjectId(foundUser.lab),
				clinicId,
			);

			foundDentistAdmins.forEach((dentistAdmin: User) => {
				const templateData = {
					RecipientName: dentistAdmin.name,
					DentistName: foundUser.name,
				};

				const notificationData: Notification = {
					_id: new Types.ObjectId(),
					isRead: false,
					type: NotificationType.CLINIC_UPDATED,
					description: templateManager.getTemplate(
						TemplateName.clinicUpdated,
						RoleCode.DENTIST_ADMIN,
						TemplateType.NOTIFICATION,
						templateData,
					),
					email: templateManager.getTemplate(
						TemplateName.clinicUpdated,
						RoleCode.DENTIST_ADMIN,
						TemplateType.EMAIL,
						templateData,
					),
					whatsapp: templateManager.getTemplate(
						TemplateName.clinicUpdated,
						RoleCode.DENTIST_ADMIN,
						TemplateType.WHATSAPP,
						templateData,
					),
					associatedId: clinicId,
					user: dentistAdmin._id,
					associatedType: AssociatedType.CLINIC,
				};

				notificationQueue.add('sendNotification', notificationData);
			});
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onUpdateBalance(clinicId: Types.ObjectId) {
	eventEmitter.emit('updateBalance', clinicId);
}

eventEmitter.on('updateBalance', async (clinicId: Types.ObjectId) => {
	try {
		const foundClinic = await ClinicRepo.findFieldsById(clinicId, 'lab');

		if (!foundClinic) return;

		const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
			extractObjectId(foundClinic.lab),
			clinicId,
		);

		foundDentistAdmins.forEach((dentistAdmin: User) => {
			const templateData = {
				RecipientName: dentistAdmin.name,
			};

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				isRead: false,
				type: NotificationType.BALANCE_UPDATED,
				description: templateManager.getTemplate(
					TemplateName.paymentUpdated,
					RoleCode.DENTIST_ADMIN,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.paymentUpdated,
					RoleCode.DENTIST_ADMIN,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.paymentUpdated,
					RoleCode.DENTIST_ADMIN,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: clinicId,
				user: dentistAdmin._id,
				associatedType: AssociatedType.CLINIC,
			};

			notificationQueue.add('sendNotification', notificationData);
		});
	} catch (err) {
		Logger.error(err);
	}
});

export default {
	onCreateClinic,
	onUpdateClinic,
	onUpdateBalance,
};
