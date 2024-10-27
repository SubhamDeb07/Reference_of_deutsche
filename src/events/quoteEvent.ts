import EventEmitter from 'events';
import { Types } from 'mongoose';
import Order from '../database/Order/model';
import TaskRepo from '../database/Task/repo';
import OrderRepo from '../database/Order/repo';
import UserRepo from '../database/User/repo';
import { TaskType } from '../database/Task/model';
import moment from 'moment';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { notificationQueue } from '../queues';
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

function onQuoteCreated(quote: Order) {
	eventEmitter.emit('quoteCreated', quote);
}

eventEmitter.on('quoteCreated', async (quote: Order) => {
	try {
		await TaskRepo.create({
			_id: new Types.ObjectId(),
			isFulfilled: false,
			type: TaskType.APPROVE_QUOTE,
			details: { order: quote._id },
			dueDate: moment().add(2, 'days').toDate(),
		});
	} catch (err) {
		Logger.error(err);
	}
});

function onPresentationApproved(
	orderId: Types.ObjectId,
	treatmentPlanner: Types.ObjectId,
) {
	eventEmitter.emit('presentationApproved', orderId, treatmentPlanner);
}

eventEmitter.on(
	'presentationApproved',
	async (orderId: Types.ObjectId, treatmentPlanner: Types.ObjectId) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(
				orderId,
				'dentist',
				'clinic',
				'patient',
				'inquiry',
				'lab',
			);

			if (foundOrder) {
				const foundPatient = await UserRepo.findFieldsById(
					extractObjectId(foundOrder.patient),
					'_id',
					'userId',
				);

				const foundDentist = await UserRepo.findFieldsById(
					extractObjectId(foundOrder.dentist),
					'_id',
					'name',
				);

				const foundPlanner = await UserRepo.findFieldsById(
					treatmentPlanner,
					'_id',
					'name',
				);

				const templateData = {
					PatientId: foundPatient?.userId || '',
					RecipientName: foundDentist?.name || '',
				};

				const notificationData: Notification = {
					_id: new Types.ObjectId(),
					isRead: false,
					type: NotificationType.QUOTE_RECEIVED,
					description: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.DENTIST,
						TemplateType.NOTIFICATION,
						templateData,
					),
					email: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.DENTIST,
						TemplateType.EMAIL,
						templateData,
					),
					whatsapp: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.DENTIST,
						TemplateType.WHATSAPP,
						templateData,
					),
					user: extractObjectId(foundOrder.dentist),
					associatedId: extractObjectId(foundOrder.inquiry),
					associatedType: AssociatedType.INQUIRY,
				};

				notificationQueue.add('sendNotification', notificationData);

				await TaskRepo.create({
					_id: new Types.ObjectId(),
					isFulfilled: false,
					type: TaskType.REVIEW_PRESENTATION,
					details: {
						order: orderId,
						inquiry: extractObjectId(foundOrder.inquiry),
					},
					dueDate: moment().add(2, 'days').toDate(),
				});

				const templateData2 = {
					RecipientName: foundPlanner?.name || '',
				};

				const notificationData2: Notification = {
					_id: new Types.ObjectId(),
					isRead: false,
					type: NotificationType.QUOTE_APPROVED,
					description: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.TREATMENT_PLANNER,
						TemplateType.NOTIFICATION,
						templateData2,
					),
					email: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.TREATMENT_PLANNER,
						TemplateType.EMAIL,
						templateData2,
					),
					whatsapp: templateManager.getTemplate(
						TemplateName.quoteApproved,
						RoleCode.TREATMENT_PLANNER,
						TemplateType.WHATSAPP,
						templateData2,
					),
					associatedId: orderId,
					user: treatmentPlanner,
					associatedType: AssociatedType.ORDER,
				};

				notificationQueue.add('sendNotification', notificationData2);
			}
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onQuoteRework(
	inquiryId: Types.ObjectId,
	treatmentPlanner: Types.ObjectId,
) {
	eventEmitter.emit('quoteRework', inquiryId, treatmentPlanner);
}

eventEmitter.on(
	'quoteRework',
	async (inquiryId: Types.ObjectId, treatmentPlanner: Types.ObjectId) => {
		try {
			const foundPlanner = await UserRepo.findFieldsById(
				treatmentPlanner,
				'_id',
				'name',
			);

			const templateData = {
				RecipientName: foundPlanner?.name || '',
			};

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				isRead: false,
				type: NotificationType.QUOTE_REWORK,
				description: templateManager.getTemplate(
					TemplateName.quoteSentToRework,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.quoteSentToRework,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.quoteSentToRework,
					RoleCode.TREATMENT_PLANNER,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: inquiryId,
				user: treatmentPlanner,
				associatedType: AssociatedType.INQUIRY,
			};

			notificationQueue.add('sendNotification', notificationData);
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onQuoteReview(orderId: Types.ObjectId) {
	eventEmitter.emit('quoteReview', orderId);
}

eventEmitter.on('quoteReview', async (orderId: Types.ObjectId) => {
	try {
		const foundOrder = await OrderRepo.findFieldsById(
			orderId,
			'dentist',
			'patient',
			'inquiry',
			'clinic',
			'lab',
		);

		if (!foundOrder) return;

		const foundPatient = await UserRepo.findFieldsById(
			extractObjectId(foundOrder.patient),
			'_id',
			'userId',
		);

		const foundDentist = await UserRepo.findFieldsById(
			extractObjectId(foundOrder.dentist),
			'_id',
			'name',
		);

		const templateData = {
			PatientId: foundPatient?.userId || '',
		};

		const notificationData: Notification = {
			_id: new Types.ObjectId(),
			isRead: false,
			type: NotificationType.QUOTE_REVIEWED,
			description: templateManager.getTemplate(
				TemplateName.orderPlaced,
				RoleCode.DENTIST,
				TemplateType.NOTIFICATION,
				templateData,
			),
			email: templateManager.getTemplate(
				TemplateName.orderPlaced,
				RoleCode.DENTIST,
				TemplateType.EMAIL,
				templateData,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.orderPlaced,
				RoleCode.DENTIST,
				TemplateType.WHATSAPP,
				templateData,
			),
			associatedId: extractObjectId(foundOrder.inquiry),
			user: extractObjectId(foundOrder.dentist),
			associatedType: AssociatedType.INQUIRY,
		};

		notificationQueue.add('sendNotification', notificationData);

		const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
			extractObjectId(foundOrder.lab),
			extractObjectId(foundOrder.clinic),
		);

		foundDentistAdmins.forEach((dentistAdmin: User) => {
			const templateData = {
				DentistName: foundDentist?.name || '',
				RecipientName: dentistAdmin.name || '',
			};

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				isRead: false,
				type: NotificationType.APPROVE_ORDER,
				description: templateManager.getTemplate(
					TemplateName.orderPlaced,
					RoleCode.DENTIST_ADMIN,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.orderPlaced,
					RoleCode.DENTIST_ADMIN,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.orderPlaced,
					RoleCode.DENTIST_ADMIN,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: extractObjectId(foundOrder.inquiry),
				user: extractObjectId(dentistAdmin._id),
				associatedType: AssociatedType.INQUIRY,
			};

			notificationQueue.add('sendNotification', notificationData);
		});

		await TaskRepo.create({
			_id: new Types.ObjectId(),
			isFulfilled: false,
			type: TaskType.APPROVE_ORDER,
			details: {
				order: orderId,
				inquiry: extractObjectId(foundOrder.inquiry),
			},
			dueDate: moment().add(2, 'days').toDate(),
		});
	} catch (err) {
		Logger.error(err);
	}
});

export default {
	onQuoteCreated,
	onPresentationApproved,
	onQuoteRework,
	onQuoteReview,
};
