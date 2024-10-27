import EventEmitter from 'events';
import _ from 'lodash';
import User from '../database/User/model';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import UserRepo from '../database/User/repo';
import TaskRepo from '../database/Task/repo';
import RoleRepo from '../database/Role/repo';
import ClinicRepo from '../database/Clinic/repo';
import { notificationQueue } from '../queues';
import Task, { TaskType } from '../database/Task/model';
import moment from 'moment';
import { extractObjectId } from '../helpers/validator';
import { Types } from 'mongoose';
import { RoleCode } from '../database/Role/model';
import Logger from '../core/Logger';
import TemplateManager, {
	TemplateData,
	TemplateName,
	TemplateType,
} from '../helpers/templateManager';

const templateManager = new TemplateManager();

const eventEmitter = new EventEmitter();

function onCreateDentist(
	dentistId: Types.ObjectId,
	createdById: Types.ObjectId,
) {
	eventEmitter.emit('dentistCreated', dentistId, createdById);
}

eventEmitter.on(
	'dentistCreated',
	async (dentistId: Types.ObjectId, createdById: Types.ObjectId) => {
		try {
			const foundCreatedBy = await UserRepo.findFieldsById(
				createdById,
				'role',
				'lab',
				'clinic',
				'name',
			);

			const createdUser = await UserRepo.findFieldsById(
				dentistId,
				'name',
				'role',
				'lab',
				'clinic',
			);

			if (!foundCreatedBy || !createdUser) return;

			const foundClinic = await ClinicRepo.findFieldsById(
				extractObjectId(createdUser.clinic!),
				'_id',
				'name',
			);

			const foundCreatedByRole = await RoleRepo.findFieldsById(
				extractObjectId(foundCreatedBy.role),
				'code',
			);

			if (!foundCreatedByRole) return;

			switch (foundCreatedByRole.code) {
				case RoleCode.DENTIST_ADMIN:
				case RoleCode.DENTIST:
					const foundLabAdmins = await UserRepo.getAllLabAdmins(
						extractObjectId(createdUser.lab),
					);

					foundLabAdmins.forEach((labAdmin: User) => {
						const templateData = {
							RecipientName: labAdmin.name,
							ClinicName: foundClinic?.name || '',
						};

						const notificationData: Notification = {
							_id: new Types.ObjectId(),
							isRead: false,
							type: NotificationType.NEW_DENTIST_CREATED,
							description: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.LAB_ADMIN,
								TemplateType.NOTIFICATION,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.LAB_ADMIN,
								TemplateType.EMAIL,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.LAB_ADMIN,
								TemplateType.WHATSAPP,
								templateData,
							),
							associatedId: dentistId,
							user: labAdmin._id,
							associatedType: AssociatedType.DENTIST,
						};

						notificationQueue.add('sendNotification', notificationData);
					});

					if (foundCreatedByRole.code === RoleCode.DENTIST) {
						if (!createdUser.clinic) return;

						const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
							extractObjectId(createdUser.lab),
							extractObjectId(createdUser.clinic),
						);

						foundDentistAdmins.forEach((dentistAdmin: User) => {
							const templateData = {
								DentistName: foundCreatedBy.name,
								RecipientName: dentistAdmin.name,
								ClinicName: foundClinic?.name || '',
							};
							const notificationData: Notification = {
								_id: new Types.ObjectId(),
								isRead: false,
								type: NotificationType.NEW_DENTIST_CREATED,
								description: templateManager.getTemplate(
									TemplateName.dentistAddedByDentist,
									RoleCode.DENTIST_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.dentistAddedByDentist,
									RoleCode.DENTIST_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.dentistAddedByDentist,
									RoleCode.DENTIST_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								associatedId: dentistId,
								user: dentistAdmin._id,
								associatedType: AssociatedType.DENTIST,
							};

							notificationQueue.add('sendNotification', notificationData);
						});
					}

					await TaskRepo.create({
						type: TaskType.APPROVE_DENTIST,
						details: { dentist: dentistId },
						dueDate: moment().add(2, 'days').toDate(),
					} as Task);
					break;
				case RoleCode.LAB_ADMIN: {
					if (!createdUser.clinic) break;

					const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
						extractObjectId(createdUser.lab),
						extractObjectId(createdUser.clinic),
					);

					foundDentistAdmins.forEach((dentistAdmin: User) => {
						const templateData = {
							DentistName: createdUser.name,
							RecipientName: dentistAdmin.name,
							ClinicName: foundClinic?.name || '',
						};

						const notificationData: Notification = {
							_id: new Types.ObjectId(),
							isRead: false,
							type: NotificationType.NEW_DENTIST_CREATED,
							description: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.DENTIST_ADMIN,
								TemplateType.NOTIFICATION,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.DENTIST_ADMIN,
								TemplateType.EMAIL,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.dentistAdded,
								RoleCode.DENTIST_ADMIN,
								TemplateType.WHATSAPP,
								templateData,
							),
							associatedId: dentistId,
							user: dentistAdmin._id,
							associatedType: AssociatedType.DENTIST,
						};

						notificationQueue.add('sendNotification', notificationData);
					});

					break;
				}
				default:
					break;
			}
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onUpdatePrivilege(userId: Types.ObjectId) {
	eventEmitter.emit('updatePrivilege', userId);
}

eventEmitter.on('updatePrivilege', async (dentistId: Types.ObjectId) => {
	try {
		const foundDentist = await UserRepo.findFieldsById(dentistId, 'name');
		if (!foundDentist) return;

		const data: TemplateData = {
			RecipientName: foundDentist?.name,
		};

		const notificationData: Notification = {
			_id: new Types.ObjectId(),
			isRead: false,
			type: NotificationType.UPDATE_PRIVILEGE,
			description: templateManager.getTemplate(
				TemplateName.privilegeUpdated,
				RoleCode.DENTIST,
				TemplateType.NOTIFICATION,
				data,
			),
			email: templateManager.getTemplate(
				TemplateName.privilegeUpdated,
				RoleCode.DENTIST,
				TemplateType.EMAIL,
				data,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.privilegeUpdated,
				RoleCode.DENTIST,
				TemplateType.WHATSAPP,
				data,
			),
			associatedId: dentistId,
			user: dentistId,
			associatedType: AssociatedType.DENTIST,
		};

		notificationQueue.add('sendNotification', notificationData);
	} catch (err) {
		Logger.error(err);
	}
});

export default {
	onCreateDentist,
	onUpdatePrivilege,
};
