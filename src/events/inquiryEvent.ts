import EventEmitter from 'events';
import { Types } from 'mongoose';
import Inquiry from '../database/Inquiry/model';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { notificationQueue } from '../queues';
import Task, { TaskType } from '../database/Task/model';
import TaskRepo from '../database/Task/repo';
import InquiryRepo from '../database/Inquiry/repo';
import UserRepo from '../database/User/repo';
import moment from 'moment';
import { extractObjectId } from '../helpers/validator';
import User from '../database/User/model';
import Logger from '../core/Logger';
import TemplateManager, {
	TemplateName,
	TemplateType,
} from '../helpers/templateManager';
import { RoleCode } from '../database/Role/model';

const templateManager = new TemplateManager();

const eventEmitter = new EventEmitter();

function onAssignTreatmentPlanner(inquiryId: Types.ObjectId) {
	eventEmitter.emit('assignTreatmentPlanner', inquiryId);
}

eventEmitter.on('assignTreatmentPlanner', async (inquiryId: Types.ObjectId) => {
	try {
		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'patient',
			'treatmentPlanner',
		);

		if (!foundInquiry || !foundInquiry.treatmentPlanner) return;

		const foundTreatmentPlanner = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry?.treatmentPlanner),
			'_id',
			'name',
		);

		const foundPatient = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.patient),
			'userId',
		);

		const templateData = {
			RecipientName: foundTreatmentPlanner?.name || '',
		};

		const notificationData: Notification = {
			_id: new Types.ObjectId(),
			type: NotificationType.ASSIGN_TREATMENT_PLANNER,
			description: templateManager.getTemplate(
				TemplateName.assignedTreatmentPlanner,
				RoleCode.TREATMENT_PLANNER,
				TemplateType.NOTIFICATION,
				templateData,
			),
			email: templateManager.getTemplate(
				TemplateName.assignedTreatmentPlanner,
				RoleCode.TREATMENT_PLANNER,
				TemplateType.EMAIL,
				templateData,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.assignedTreatmentPlanner,
				RoleCode.TREATMENT_PLANNER,
				TemplateType.WHATSAPP,
				templateData,
			),
			user: extractObjectId(foundInquiry.treatmentPlanner),
			associatedId: foundPatient?.userId || '',
			associatedType: AssociatedType.USER_ID,
			isRead: false,
		};

		notificationQueue.add('sendNotification', notificationData);

		await TaskRepo.create({
			type: TaskType.SET_QUOTE_ESTIMATE_DATE,
			details: { inquiry: inquiryId },
			dueDate: moment().add(2, 'days').toDate(),
		} as Task);
	} catch (err) {
		Logger.error(err);
	}
});

function onPlannerSetDate(inquiryId: Types.ObjectId) {
	eventEmitter.emit('plannerSetDate', inquiryId);
}

eventEmitter.on('plannerSetDate', async (inquiryId: Types.ObjectId) => {
	try {
		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'dentist',
			'patient',
			'lab',
			'clinic',
			'quoteEstimationDate',
		);

		if (!foundInquiry || !foundInquiry.quoteEstimationDate) return;

		const foundDentist = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.dentist),
			'_id',
			'name',
		);

		const foundPatient = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.patient),
			'userId',
		);

		const templateData = {
			RecipientName: foundDentist?.name || '',
			PatientId: foundPatient?.userId || '',
		};

		const notificationData: Notification = {
			_id: new Types.ObjectId(),
			type: NotificationType.PLANNER_SET_ESTIMATE,
			description: templateManager.getTemplate(
				TemplateName.treatmentEstimationProvided,
				RoleCode.DENTIST,
				TemplateType.NOTIFICATION,
				templateData,
			),
			email: templateManager.getTemplate(
				TemplateName.treatmentEstimationProvided,
				RoleCode.DENTIST,
				TemplateType.EMAIL,
				templateData,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.treatmentEstimationProvided,
				RoleCode.DENTIST,
				TemplateType.WHATSAPP,
				templateData,
			),
			associatedId: inquiryId,
			user: foundInquiry.dentist,
			associatedType: AssociatedType.INQUIRY,
			isRead: false,
		};

		notificationQueue.add('sendNotification', notificationData);

		await TaskRepo.create({
			_id: new Types.ObjectId(),
			isFulfilled: false,
			type: TaskType.SUBMIT_PRESENTATION,
			details: { inquiry: inquiryId },
			dueDate: moment(foundInquiry.quoteEstimationDate).add(2, 'days').toDate(),
		});
	} catch (err) {
		Logger.error(err);
	}
});

function onImpressionDelivered(inquiryId: Types.ObjectId) {
	eventEmitter.emit('impressionDelivered', inquiryId);
}

eventEmitter.on('impressionDelivered', async (inquiryId: Types.ObjectId) => {
	try {
		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'dentist',
			'treatmentPlanner',
			'lab',
			'clinic',
			'patient',
		);

		if (!foundInquiry) return;

		const foundDentist = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.dentist),
			'_id',
			'name',
		);

		const foundPatient = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.patient),
			'userId',
		);

		const templateData = {
			RecipientName: foundDentist?.name || '',
			PatientId: foundPatient?.userId || '',
		};

		const notificationData: Notification = {
			_id: new Types.ObjectId(),
			type: NotificationType.IMPRESSION_DELIVERED,
			description: templateManager.getTemplate(
				TemplateName.impressionReceived,
				RoleCode.DENTIST,
				TemplateType.NOTIFICATION,
				templateData,
			),
			email: templateManager.getTemplate(
				TemplateName.impressionReceived,
				RoleCode.DENTIST,
				TemplateType.EMAIL,
				templateData,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.impressionReceived,
				RoleCode.DENTIST,
				TemplateType.WHATSAPP,
				templateData,
			),
			associatedId: inquiryId,
			user: foundInquiry.dentist,
			associatedType: AssociatedType.INQUIRY,
			isRead: false,
		};

		notificationQueue.add('sendNotification', notificationData);

		if (foundInquiry.treatmentPlanner) {
			const foundTreatmentPlanner = await UserRepo.findFieldsById(
				extractObjectId(foundInquiry.treatmentPlanner),
				'_id',
				'name',
			);

			templateData.RecipientName = foundTreatmentPlanner?.name || '';

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				type: NotificationType.IMPRESSION_DELIVERED,
				description: templateManager.getTemplate(
					TemplateName.impressionReceived,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.impressionReceived,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.impressionReceived,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: inquiryId,
				user: foundInquiry.treatmentPlanner,
				associatedType: AssociatedType.INQUIRY,
				isRead: false,
			};

			notificationQueue.add('sendNotification', notificationData);
		}
	} catch (err) {
		Logger.error(err);
	}
});

function onInquiryCreated(inquiryId: Types.ObjectId) {
	eventEmitter.emit('inquiryCreated', inquiryId);
}

eventEmitter.on('inquiryCreated', async (inquiryId: Types.ObjectId) => {
	try {
		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'dentist',
			'lab',
			'patient',
		);

		if (!foundInquiry) return;

		const foundLabAdmins = await UserRepo.getAllLabAdmins(
			extractObjectId(foundInquiry.lab),
		);

		const foundPatient = await UserRepo.findFieldsById(
			extractObjectId(foundInquiry.patient),
			'userId',
		);

		foundLabAdmins.forEach((labAdmin: User) => {
			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				type: NotificationType.INQUIRY_RECEIVED,
				description: 'A new query has been received.',
				associatedId: foundPatient?.userId || '',
				user: labAdmin._id,
				associatedType: AssociatedType.USER_ID,
				isRead: false,
			};

			notificationQueue.add('sendNotification', notificationData);
		});

		await TaskRepo.create({
			_id: new Types.ObjectId(),
			isFulfilled: false,
			type: TaskType.SUBMIT_IMPRESSION,
			details: { inquiry: inquiryId },
			dueDate: moment().add(1, 'days').toDate(),
		});
	} catch (err) {
		Logger.error(err);
	}
});

export default {
	onImpressionDelivered,
	onAssignTreatmentPlanner,
	onPlannerSetDate,
	onInquiryCreated,
};
