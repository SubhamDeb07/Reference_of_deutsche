import EventEmitter from 'events';
import { Types } from 'mongoose';
import User from '../database/User/model';
import Notification, {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { TaskType } from '../database/Task/model';
import UserRepo from '../database/User/repo';
import InquiryRepo from '../database/Inquiry/repo';
import OrderRepo from '../database/Order/repo';
import TaskRepo from '../database/Task/repo';
import { notificationQueue } from '../queues';
import moment from 'moment';
import { extractObjectId } from '../helpers/validator';
import Logger from '../core/Logger';
import TemplateManager, {
	TemplateName,
	TemplateType,
} from '../helpers/templateManager';
import { RoleCode } from '../database/Role/model';

const templateManager = new TemplateManager();

const eventEmitter = new EventEmitter();

function onAssignProduction(
	orderId: Types.ObjectId,
	subOrderId: Types.ObjectId,
	productionManagerId: Types.ObjectId,
) {
	eventEmitter.emit(
		'assignProduction',
		orderId,
		subOrderId,
		productionManagerId,
	);
}

eventEmitter.on(
	'assignProduction',
	async (
		orderId: Types.ObjectId,
		subOrderId: Types.ObjectId,
		productionManager: Types.ObjectId,
	) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(orderId, 'patient');

			if (!foundOrder) return;

			const foundProductionManager = await UserRepo.findFieldsById(
				productionManager,
				'_id',
				'name',
			);

			const foundPatient = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.patient),
				'userId',
			);

			const templateData = {
				RecipientName: foundProductionManager?.name || '',
			};

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				type: NotificationType.ASSIGN_PRODUCTION,
				description: templateManager.getTemplate(
					TemplateName.assignedProductionManager,
					RoleCode.PRODUCTION_MANAGER,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.assignedProductionManager,
					RoleCode.PRODUCTION_MANAGER,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.assignedProductionManager,
					RoleCode.PRODUCTION_MANAGER,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: foundPatient?.userId || '',
				user: productionManager,
				associatedType: AssociatedType.USER_ID,
				isRead: false,
			};

			notificationQueue.add('sendNotification', notificationData);

			await TaskRepo.create({
				_id: new Types.ObjectId(),
				type: TaskType.SET_PRODUCTION_ESTIMATE_DATE,
				details: { order: orderId, subOrder: subOrderId },
				dueDate: moment().add(2, 'days').toDate(),
				isFulfilled: false,
			});
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onProductionSetDate(
	orderId: Types.ObjectId,
	subOrderId: Types.ObjectId,
) {
	eventEmitter.emit('productionSetDate', orderId, subOrderId);
}

eventEmitter.on(
	'productionSetDate',
	async (orderId: Types.ObjectId, subOrderId: Types.ObjectId) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(
				orderId,
				'lab',
				'clinic',
				'dentist',
				'patient',
				'deliveries',
			);

			if (!foundOrder) return;

			const foundDentist = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.dentist),
				'_id',
				'name',
			);

			const foundPatient = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.patient),
				'userId',
			);

			const templateData = {
				RecipientName: foundDentist?.name || '',
				PatientId: foundPatient?.userId || '',
			};

			notificationQueue.add('sendNotification', {
				_id: new Types.ObjectId(),
				type: NotificationType.PRODUCTION_SET_ESTIMATE,
				description: templateManager.getTemplate(
					TemplateName.productionEstimationProvided,
					RoleCode.DENTIST,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.productionEstimationProvided,
					RoleCode.DENTIST,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.productionEstimationProvided,
					RoleCode.DENTIST,
					TemplateType.WHATSAPP,
					templateData,
				),
				associatedId: orderId,
				user: foundOrder.dentist,
				associatedType: AssociatedType.ORDER,
				isRead: false,
			});

			const foundSubOrder = foundOrder.deliveries.find((delivery) =>
				delivery._id.equals(subOrderId),
			);

			if (foundSubOrder) {
				await TaskRepo.create({
					_id: new Types.ObjectId(),
					isFulfilled: false,
					type: TaskType.SUBMIT_PRODUCTION,
					details: { order: orderId, subOrder: subOrderId },
					dueDate: moment(foundSubOrder.productionEstimationDate)
						.subtract(1, 'days')
						.toDate(),
				});
			}
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onAssignDelivery(orderId: Types.ObjectId, subOrderId: Types.ObjectId) {
	eventEmitter.emit('assignDelivery', orderId, subOrderId);
}

eventEmitter.on(
	'assignDelivery',
	async (orderId: Types.ObjectId, subOrderId: Types.ObjectId) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(
				orderId,
				'lab',
				'clinic',
				'dentist',
				'deliveries',
				'patient',
			);

			if (!foundOrder) return;

			const foundSubOrder = foundOrder.deliveries.find((delivery) =>
				delivery._id.equals(subOrderId),
			);

			if (foundSubOrder) {
				const foundPatient = await UserRepo.findFieldsById(
					extractObjectId(foundOrder.patient),
					'userId',
				);

				const foundDeliveryCoordinators =
					await UserRepo.getAllLabDeliveryCoordinators(
						extractObjectId(foundOrder.lab),
					);

				foundDeliveryCoordinators.forEach((deliveryCoordinator: User) => {
					const templateData = {
						RecipientName: deliveryCoordinator.name,
						PatientId: foundPatient?.userId || '',
					};

					const notificationData: Notification = {
						_id: new Types.ObjectId(),
						type: NotificationType.ORDER_ASSIGNED,
						description: templateManager.getTemplate(
							TemplateName.assignedDeliveryCoordinator,
							RoleCode.DELIVERY_COORDINATOR,
							TemplateType.NOTIFICATION,
							templateData,
						),
						email: templateManager.getTemplate(
							TemplateName.assignedDeliveryCoordinator,
							RoleCode.DELIVERY_COORDINATOR,
							TemplateType.EMAIL,
							templateData,
						),
						whatsapp: templateManager.getTemplate(
							TemplateName.assignedDeliveryCoordinator,
							RoleCode.DELIVERY_COORDINATOR,
							TemplateType.WHATSAPP,
							templateData,
						),
						user: deliveryCoordinator._id,
						associatedId: extractObjectId(foundOrder.patient),
						associatedType: AssociatedType.USER,
						isRead: false,
					};

					notificationQueue.add('sendNotification', notificationData);
				});

				await TaskRepo.create({
					_id: new Types.ObjectId(),
					isFulfilled: false,
					type: TaskType.SHIP_ORDER,
					details: { order: orderId, subOrder: subOrderId },
					dueDate: moment().add(2, 'days').toDate(),
				});
			}
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onReceiveOrder(orderId: Types.ObjectId, subOrderId: Types.ObjectId) {
	eventEmitter.emit('receiveOrder', orderId, subOrderId);
}

eventEmitter.on(
	'receiveOrder',
	async (orderId: Types.ObjectId, subOrderId: Types.ObjectId) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(
				orderId,
				'lab',
				'clinic',
				'patient',
				'dentist',
				'deliveries',
			);

			if (!foundOrder) return;

			const foundDentist = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.dentist),
				'_id',
				'name',
			);

			const foundPatient = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.patient),
				'userId',
			);

			const templateData = {
				RecipientName: foundDentist?.name || '',
				PatientId: foundPatient?.userId || '',
			};

			notificationQueue.add('sendNotification', {
				_id: new Types.ObjectId(),
				type: NotificationType.ORDER_RECEIVED,
				description: templateManager.getTemplate(
					TemplateName.orderDelivered,
					RoleCode.DENTIST,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.orderDelivered,
					RoleCode.DENTIST,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.orderDelivered,
					RoleCode.DENTIST,
					TemplateType.WHATSAPP,
					templateData,
				),
				user: foundOrder.dentist,
				associatedId: orderId,
				associatedType: AssociatedType.ORDER,
				isRead: false,
			});

			const foundSubOrder = foundOrder.deliveries.find((delivery) =>
				delivery._id.equals(subOrderId),
			);

			if (foundSubOrder && foundSubOrder.deliveryCoordinator) {
				const foundDeliveryCoordinator = await UserRepo.findFieldsById(
					extractObjectId(foundSubOrder.deliveryCoordinator),
					'_id',
					'name',
				);

				templateData.RecipientName = foundDeliveryCoordinator?.name || '';

				const notificationData: Notification = {
					_id: new Types.ObjectId(),
					type: NotificationType.ORDER_RECEIVED,
					description: templateManager.getTemplate(
						TemplateName.orderDelivered,
						RoleCode.DELIVERY_COORDINATOR,
						TemplateType.NOTIFICATION,
						templateData,
					),
					email: templateManager.getTemplate(
						TemplateName.orderDelivered,
						RoleCode.DELIVERY_COORDINATOR,
						TemplateType.EMAIL,
						templateData,
					),
					whatsapp: templateManager.getTemplate(
						TemplateName.orderDelivered,
						RoleCode.DELIVERY_COORDINATOR,
						TemplateType.WHATSAPP,
						templateData,
					),
					user: foundSubOrder.deliveryCoordinator,
					associatedId: orderId,
					associatedType: AssociatedType.ORDER,
					isRead: false,
				};

				notificationQueue.add('sendNotification', notificationData);
			}
		} catch (err) {
			Logger.error(err);
		}
	},
);

function onApproveOrder(inquiryId: Types.ObjectId) {
	eventEmitter.emit('approveOrder', inquiryId);
}

eventEmitter.on('approveOrder', async (inquiryId: Types.ObjectId) => {
	try {
		const foundInquiry = await InquiryRepo.findFieldsById(
			inquiryId,
			'dentist',
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
			type: NotificationType.ORDER_APPROVED,
			description: templateManager.getTemplate(
				TemplateName.orderApproved,
				RoleCode.DENTIST,
				TemplateType.NOTIFICATION,
				templateData,
			),
			email: templateManager.getTemplate(
				TemplateName.orderApproved,
				RoleCode.DENTIST,
				TemplateType.EMAIL,
				templateData,
			),
			whatsapp: templateManager.getTemplate(
				TemplateName.orderApproved,
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
	} catch (err) {
		Logger.error(err);
	}
});

function onOrderShip(orderId: Types.ObjectId, subOrderId: Types.ObjectId) {
	eventEmitter.emit('orderShip', orderId, subOrderId);
}

eventEmitter.on(
	'orderShip',
	async (orderId: Types.ObjectId, subOrderId: Types.ObjectId) => {
		try {
			const foundOrder = await OrderRepo.findFieldsById(
				orderId,
				'lab',
				'patient',
				'clinic',
				'dentist',
			);

			if (!foundOrder) return;

			const foundDentist = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.dentist),
				'_id',
				'name',
			);

			if (!foundDentist) return;

			const foundPatient = await UserRepo.findFieldsById(
				extractObjectId(foundOrder.patient),
				'userId',
			);

			const templateData = {
				RecipientName: foundDentist?.name || '',
				PatientId: foundPatient?.userId || '',
			};

			const notificationData: Notification = {
				_id: new Types.ObjectId(),
				type: NotificationType.ORDER_SHIPPED,
				description: templateManager.getTemplate(
					TemplateName.orderShipped,
					RoleCode.DENTIST,
					TemplateType.NOTIFICATION,
					templateData,
				),
				email: templateManager.getTemplate(
					TemplateName.orderShipped,
					RoleCode.DENTIST,
					TemplateType.EMAIL,
					templateData,
				),
				whatsapp: templateManager.getTemplate(
					TemplateName.orderShipped,
					RoleCode.DENTIST,
					TemplateType.WHATSAPP,
					templateData,
				),
				user: foundDentist._id,
				associatedId: orderId,
				associatedType: AssociatedType.ORDER,
				isRead: false,
			};

			notificationQueue.add('sendNotification', notificationData);

			await TaskRepo.create({
				_id: new Types.ObjectId(),
				isFulfilled: false,
				type: TaskType.RECEIVE_ORDER,
				details: { order: orderId, subOrder: subOrderId },
				dueDate: moment().add(2, 'days').toDate(),
			});
		} catch (err) {
			Logger.error(err);
		}
	},
);

export default {
	onAssignProduction,
	onOrderShip,
	onProductionSetDate,
	onAssignDelivery,
	onReceiveOrder,
	onApproveOrder,
};
