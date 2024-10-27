import cron from 'node-cron';
import TaskRepo from '../database/Task/repo';
import UserRepo from '../database/User/repo';
import InquiryRepo from '../database/Inquiry/repo';
import OrderRepo from '../database/Order/repo';
import ClinicRepo from '../database/Clinic/repo';
import Task, { TaskType } from '../database/Task/model';
import { notificationQueue } from '../queues';
import {
	AssociatedType,
	NotificationType,
} from '../database/Notification/model';
import { Types } from 'mongoose';
import User, { ApprovalStatus } from '../database/User/model';
import { extractObjectId } from '../helpers/validator';
import moment from 'moment';
import { OrderStatus, QuoteStatus } from '../database/Order/model';
import { ImpressionStatus } from '../database/Inquiry/model';
import Logger from '../core/Logger';
import TemplateManager, {
	TemplateName,
	TemplateType,
} from '../helpers/templateManager';
import { RoleCode } from '../database/Role/model';

const templateManager = new TemplateManager();

export const taskJob = cron.schedule('*/15 * * * *', async () => {
	try {
		const tasks = await TaskRepo.getUnFulfilled();

		for (const task of tasks) {
			switch (task.type) {
				case TaskType.APPROVE_DENTIST: {
					const foundDentist = await UserRepo.findFieldsById(
						task.details.dentist as Types.ObjectId,
						'approvalStatus',
						'lab',
						'clinic',
					);

					if (
						foundDentist &&
						foundDentist.clinic &&
						foundDentist.approvalStatus === ApprovalStatus.PENDING
					) {
						const foundClinic = await ClinicRepo.findFieldsById(
							extractObjectId(foundDentist.clinic),
							'lab',
							'name',
						);

						const templateData = {
							ClinicName: foundClinic?.name || '',
							RecipientName: '',
						};

						const foundLabAdmins = await UserRepo.getAllLabAdmins(
							extractObjectId(foundDentist.lab),
						);

						for (const admin of foundLabAdmins) {
							templateData.RecipientName = admin.name;

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.NEW_DENTIST_CREATED,
								description: templateManager.getTemplate(
									TemplateName.remindDentistApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindDentistApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindDentistApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: admin._id,
								associatedId: foundDentist._id,
								associatedType: AssociatedType.DENTIST,
								isRead: false,
							});
						}

						await TaskRepo.create({
							type: task.type,
							details: task.details,
							dueDate: moment(task.dueDate).add(2, 'days').toDate(),
						} as Task);
					}
					break;
				}
				case TaskType.SET_QUOTE_ESTIMATE_DATE: {
					const foundInquiry = await InquiryRepo.findFieldsById(
						task.details.inquiry as Types.ObjectId,
						'treatmentPlanner',
						'lab',
					);

					if (
						foundInquiry &&
						foundInquiry.treatmentPlanner &&
						!foundInquiry.quoteEstimationDate
					) {
						const foundTreatmentPlanner = await UserRepo.findFieldsById(
							extractObjectId(foundInquiry.treatmentPlanner),
							'name',
						);

						const foundLabAdmins = await UserRepo.getAllLabAdmins(
							extractObjectId(foundInquiry.lab),
						);

						for (const admin of foundLabAdmins) {
							const templateData = {
								RecipientName: admin.name,
								TreatmentPlannerName: foundTreatmentPlanner?.name || '',
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.PLANNER_SET_ESTIMATE,
								description: templateManager.getTemplate(
									TemplateName.remindSetTreatmentEstimation,
									RoleCode.LAB_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindSetTreatmentEstimation,
									RoleCode.LAB_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindSetTreatmentEstimation,
									RoleCode.LAB_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: admin._id,
								associatedId: foundInquiry._id,
								associatedType: AssociatedType.INQUIRY,
								isRead: false,
							});
						}

						notificationQueue.add('sendNotification', {
							_id: new Types.ObjectId(),
							type: NotificationType.PLANNER_SET_ESTIMATE,
							description:
								'A query from 2-3 days ago is still pending. Immediate attention needed.',
							user: foundInquiry.treatmentPlanner,
							associatedId: foundInquiry._id,
							associatedType: AssociatedType.INQUIRY,
							isRead: false,
						});

						await TaskRepo.create({
							type: task.type,
							details: task.details,
							dueDate: moment(task.dueDate).add(2, 'days').toDate(),
						} as Task);
					}
					break;
				}
				case TaskType.SUBMIT_PRESENTATION: {
					const foundInquiry = await InquiryRepo.findFieldsById(
						task.details.inquiry as Types.ObjectId,
						'treatmentPlanner',
						'dentist',
						'quoteStatus',
						'quoteEstimationDate',
						'lab',
					);

					if (
						foundInquiry &&
						foundInquiry.treatmentPlanner &&
						foundInquiry.quoteStatus === QuoteStatus.PENDING
					) {
						const foundTreatmentPlanner = await UserRepo.findFieldsById(
							extractObjectId(foundInquiry.treatmentPlanner),
							'name',
						);
						const foundLabAdmins = await UserRepo.getAllLabAdmins(
							extractObjectId(foundInquiry.lab),
						);

						for (const admin of foundLabAdmins) {
							const templateData = {
								RecipientName: admin.name,
								TreatmentPlannerName: foundTreatmentPlanner?.name || '',
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.SUBMIT_PRESENTATION,
								description: templateManager.getTemplate(
									TemplateName.remindQuoteDue,
									RoleCode.LAB_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindQuoteDue,
									RoleCode.LAB_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindQuoteDue,
									RoleCode.LAB_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: admin._id,
								associatedId: foundInquiry._id,
								associatedType: AssociatedType.INQUIRY,
								isRead: false,
							});
						}

						const templateData = {
							RecipientName: foundTreatmentPlanner?.name || '',
						};

						notificationQueue.add('sendNotification', {
							_id: new Types.ObjectId(),
							type: NotificationType.SUBMIT_PRESENTATION,
							description: templateManager.getTemplate(
								TemplateName.remindQuoteDue,
								RoleCode.TREATMENT_PLANNER,
								TemplateType.NOTIFICATION,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.remindQuoteDue,
								RoleCode.TREATMENT_PLANNER,
								TemplateType.EMAIL,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.remindQuoteDue,
								RoleCode.TREATMENT_PLANNER,
								TemplateType.WHATSAPP,
								templateData,
							),
							user: foundInquiry.treatmentPlanner,
							associatedId: foundInquiry._id,
							associatedType: AssociatedType.INQUIRY,
							isRead: false,
						});
					}
					break;
				}
				case TaskType.SET_PRODUCTION_ESTIMATE_DATE: {
					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order as Types.ObjectId,
						'deliveries',
						'lab',
					);

					if (foundOrder && foundOrder.deliveries.length > 0) {
						const foundSubOrder = foundOrder.deliveries.find(
							(delivery) => delivery._id === task.details.subOrder,
						);

						if (
							foundSubOrder &&
							foundSubOrder.productionManager &&
							!foundSubOrder.productionEstimationDate
						) {
							const foundProductionManager = await UserRepo.findFieldsById(
								extractObjectId(foundSubOrder.productionManager),
								'name',
							);

							const templateData = {
								RecipientName: foundProductionManager?.name || '',
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.PRODUCTION_SET_ESTIMATE,
								description: templateManager.getTemplate(
									TemplateName.remindSetProductionEstimation,
									RoleCode.PRODUCTION_MANAGER,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindSetProductionEstimation,
									RoleCode.PRODUCTION_MANAGER,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindSetProductionEstimation,
									RoleCode.PRODUCTION_MANAGER,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: foundSubOrder.productionManager,
								associatedId: foundOrder._id,
								associatedType: AssociatedType.ORDER,
								isRead: false,
							});
						}
					}
					break;
				}
				case TaskType.SUBMIT_PRODUCTION: {
					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order as Types.ObjectId,
						'deliveries',
						'lab',
					);

					if (foundOrder && foundOrder.deliveries.length > 0) {
						const foundSubOrder = foundOrder.deliveries.find(
							(delivery) => delivery._id === task.details.subOrder,
						);

						if (
							foundSubOrder &&
							foundSubOrder.productionManager &&
							foundSubOrder.status === OrderStatus.DENTIST_APPROVED
						) {
							const foundProductionManager = await UserRepo.findFieldsById(
								extractObjectId(foundSubOrder.productionManager),
								'name',
							);

							const foundLabAdmins = await UserRepo.getAllLabAdmins(
								extractObjectId(foundOrder.lab),
							);

							if (
								moment().isBefore(
									moment(foundSubOrder.productionEstimationDate),
								)
							) {
								for (const admin of foundLabAdmins) {
									const templateData = {
										RecipientName: admin.name,
										ProductionManagerName: foundProductionManager?.name || '',
									};

									notificationQueue.add('sendNotification', {
										_id: new Types.ObjectId(),
										type: NotificationType.SUBMIT_PRODUCTION,
										description: templateManager.getTemplate(
											TemplateName.remindProductionDue,
											RoleCode.LAB_ADMIN,
											TemplateType.NOTIFICATION,
											templateData,
										),
										email: templateManager.getTemplate(
											TemplateName.remindProductionDue,
											RoleCode.LAB_ADMIN,
											TemplateType.EMAIL,
											templateData,
										),
										whatsapp: templateManager.getTemplate(
											TemplateName.remindProductionDue,
											RoleCode.LAB_ADMIN,
											TemplateType.WHATSAPP,
											templateData,
										),
										user: admin._id,
										associatedId: foundOrder._id,
										associatedType: AssociatedType.ORDER,
										isRead: false,
									});
								}

								notificationQueue.add('sendNotification', {
									_id: new Types.ObjectId(),
									type: NotificationType.SUBMIT_PRODUCTION,
									description: templateManager.getTemplate(
										TemplateName.remindProductionDue,
										RoleCode.PRODUCTION_MANAGER,
										TemplateType.NOTIFICATION,
										{
											RecipientName: foundProductionManager?.name || '',
										},
									),
									email: templateManager.getTemplate(
										TemplateName.remindProductionDue,
										RoleCode.PRODUCTION_MANAGER,
										TemplateType.EMAIL,
										{
											RecipientName: foundProductionManager?.name || '',
										},
									),
									whatsapp: templateManager.getTemplate(
										TemplateName.remindProductionDue,
										RoleCode.PRODUCTION_MANAGER,
										TemplateType.WHATSAPP,
										{
											RecipientName: foundProductionManager?.name || '',
										},
									),
									user: foundSubOrder.productionManager,
									associatedId: foundOrder._id,
									associatedType: AssociatedType.ORDER,
									isRead: false,
								});
							} else {
								for (const admin of foundLabAdmins) {
									const templateData = {
										RecipientName: admin.name,
										ProductionManagerName: foundProductionManager?.name || '',
									};

									notificationQueue.add('sendNotification', {
										_id: new Types.ObjectId(),
										type: NotificationType.SUBMIT_PRODUCTION,
										description: templateManager.getTemplate(
											TemplateName.productionOverDue,
											RoleCode.LAB_ADMIN,
											TemplateType.NOTIFICATION,
											templateData,
										),
										email: templateManager.getTemplate(
											TemplateName.productionOverDue,
											RoleCode.LAB_ADMIN,
											TemplateType.EMAIL,
											templateData,
										),
										whatsapp: templateManager.getTemplate(
											TemplateName.productionOverDue,
											RoleCode.LAB_ADMIN,
											TemplateType.WHATSAPP,
											templateData,
										),
										user: admin._id,
										associatedId: foundOrder._id,
										associatedType: AssociatedType.ORDER,
										isRead: false,
									});
								}
							}

							await TaskRepo.create({
								_id: new Types.ObjectId(),
								type: task.type,
								details: task.details,
								dueDate: moment(task.dueDate).add(2, 'days').toDate(),
								isFulfilled: false,
							});
						}
					}
					break;
				}
				case TaskType.SHIP_ORDER: {
					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order as Types.ObjectId,
						'patient',
						'deliveries',
						'lab',
					);

					if (foundOrder && foundOrder.deliveries.length > 0) {
						const foundSubOrder = foundOrder.deliveries.find(
							(delivery) => delivery._id === task.details.subOrder,
						);

						if (
							foundSubOrder &&
							foundSubOrder.deliveryCoordinator &&
							foundSubOrder.status === OrderStatus.DELIVERY_PENDING
						) {
							const foundDeliveryCoordinator = await UserRepo.findFieldsById(
								extractObjectId(foundSubOrder.deliveryCoordinator),
								'name',
							);

							const foundPatient = await UserRepo.findFieldsById(
								extractObjectId(foundOrder.patient),
								'userId',
							);

							const templateData = {
								RecipientName: foundDeliveryCoordinator?.name || '',
								PatientId: foundPatient?.userId || '',
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.SHIP_ORDER,
								description: templateManager.getTemplate(
									TemplateName.remindShipOrder,
									RoleCode.DELIVERY_COORDINATOR,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindShipOrder,
									RoleCode.DELIVERY_COORDINATOR,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindShipOrder,
									RoleCode.DELIVERY_COORDINATOR,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: foundSubOrder.deliveryCoordinator,
								associatedId: foundOrder._id,
								associatedType: AssociatedType.ORDER,
								isRead: false,
							});

							const foundLabAdmins = await UserRepo.getAllLabAdmins(
								extractObjectId(foundOrder.lab),
							);

							for (const admin of foundLabAdmins) {
								const templateData = {
									RecipientName: admin.name,
									DeliveryCoordinatorName: foundDeliveryCoordinator?.name || '',
								};

								notificationQueue.add('sendNotification', {
									_id: new Types.ObjectId(),
									type: NotificationType.SHIP_ORDER,
									description: templateManager.getTemplate(
										TemplateName.remindShipOrder,
										RoleCode.LAB_ADMIN,
										TemplateType.NOTIFICATION,
										templateData,
									),
									email: templateManager.getTemplate(
										TemplateName.remindShipOrder,
										RoleCode.LAB_ADMIN,
										TemplateType.EMAIL,
										templateData,
									),
									whatsapp: templateManager.getTemplate(
										TemplateName.remindShipOrder,
										RoleCode.LAB_ADMIN,
										TemplateType.WHATSAPP,
										templateData,
									),
									user: admin._id,
									associatedId: foundOrder._id,
									associatedType: AssociatedType.ORDER,
									isRead: false,
								});
							}

							await TaskRepo.create({
								_id: new Types.ObjectId(),
								type: task.type,
								details: task.details,
								dueDate: moment(task.dueDate).add(2, 'days').toDate(),
								isFulfilled: false,
							});
						}
					}

					break;
				}
				case TaskType.REVIEW_PRESENTATION: {
					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order as Types.ObjectId,
						'lab',
						'dentist',
						'inquiry',
						'quoteDetails',
					);

					if (
						foundOrder &&
						foundOrder.quoteDetails.status === QuoteStatus.ADMIN_APPROVED
					) {
						const foundDentist = await UserRepo.findFieldsById(
							extractObjectId(foundOrder.dentist),
							'name',
						);

						const templateData = {
							RecipientName: foundDentist?.name || '',
						};

						notificationQueue.add('sendNotification', {
							_id: new Types.ObjectId(),
							type: NotificationType.QUOTE_RECEIVED,
							description: templateManager.getTemplate(
								TemplateName.remindReviewQuote,
								RoleCode.DENTIST,
								TemplateType.NOTIFICATION,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.remindReviewQuote,
								RoleCode.DENTIST,
								TemplateType.WHATSAPP,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.remindReviewQuote,
								RoleCode.DENTIST,
								TemplateType.EMAIL,
								templateData,
							),
							user: foundOrder.dentist,
							associatedId: extractObjectId(foundOrder.inquiry),
							associatedType: AssociatedType.INQUIRY,
							isRead: false,
						});
					}
					break;
				}
				case TaskType.SUBMIT_IMPRESSION: {
					const foundInquiry = await InquiryRepo.findFieldsById(
						task.details.inquiry as Types.ObjectId,
						'dentist',
						'impressionStatus',
						'lab',
						'clinic',
						'patient',
					);

					if (!foundInquiry) break;

					if (foundInquiry.impressionStatus === ImpressionStatus.PENDING) {
						const foundDentist = await UserRepo.findFieldsById(
							extractObjectId(foundInquiry.dentist),
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

						notificationQueue.add('sendNotification', {
							_id: new Types.ObjectId(),
							type: NotificationType.SUBMIT_IMPRESSION,
							description: templateManager.getTemplate(
								TemplateName.remindImpressionPending,
								RoleCode.DENTIST,
								TemplateType.NOTIFICATION,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.remindImpressionPending,
								RoleCode.DENTIST,
								TemplateType.WHATSAPP,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.remindImpressionPending,
								RoleCode.DENTIST,
								TemplateType.EMAIL,
								templateData,
							),
							user: foundInquiry.dentist,
							associatedId: foundInquiry._id,
							associatedType: AssociatedType.INQUIRY,
							isRead: false,
						});

						await TaskRepo.create({
							_id: new Types.ObjectId(),
							type: task.type,
							details: task.details,
							dueDate: moment(task.dueDate).add(2, 'days').toDate(),
							isFulfilled: false,
						});
					}
					break;
				}
				case TaskType.APPROVE_ORDER: {
					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order as Types.ObjectId,
						'lab',
						'clinic',
						'dentist',
						'inquiry',
						'quoteDetails',
					);

					if (
						foundOrder &&
						foundOrder.quoteDetails.status === QuoteStatus.DENTIST_REVIEWED
					) {
						const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
							extractObjectId(foundOrder.lab),
							extractObjectId(foundOrder.clinic),
						);

						const foundDentist = await UserRepo.findFieldsById(
							extractObjectId(foundOrder.dentist),
							'_id',
							'name',
						);

						foundDentistAdmins.forEach((dentistAdmin: User) => {
							const templateData = {
								DentistName: foundDentist?.name || '',
								RecipientName: dentistAdmin.name || '',
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.APPROVE_ORDER,
								description: templateManager.getTemplate(
									TemplateName.remindApproveOrder,
									RoleCode.DENTIST_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindApproveOrder,
									RoleCode.DENTIST_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindApproveOrder,
									RoleCode.DENTIST_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								user: dentistAdmin._id,
								associatedId: extractObjectId(foundOrder.inquiry),
								associatedType: AssociatedType.INQUIRY,
								isRead: false,
							});
						});
					}
					break;
				}
				case TaskType.DUE_PAYMENT: {
					const foundClinic = await ClinicRepo.findFieldsById(
						task.details.clinic as Types.ObjectId,
						'lab',
						'clinic',
						'paidAmount',
						'dueAmount',
					);

					if (!foundClinic) break;

					const balanceAmount = foundClinic.dueAmount - foundClinic.paidAmount;

					if (balanceAmount > 0) {
						const foundDentistAdmins = await UserRepo.getAllDentistAdmins(
							extractObjectId(foundClinic.lab),
							extractObjectId(foundClinic._id),
						);

						const templateData = {
							DueAmount: balanceAmount.toString(),
							RecipientName: '',
						};

						foundDentistAdmins.forEach((dentistAdmin: User) => {
							templateData.RecipientName = dentistAdmin.name;

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.DUE_AMOUNT,
								description: templateManager.getTemplate(
									TemplateName.remindPayout,
									RoleCode.DENTIST_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindPayout,
									RoleCode.DENTIST_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindPayout,
									RoleCode.DENTIST_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								user: dentistAdmin._id,
								associatedId: foundClinic._id,
								associatedType: AssociatedType.CLINIC,
								isRead: false,
							});
						});
					}

					await TaskRepo.create({
						_id: new Types.ObjectId(),
						type: task.type,
						details: task.details,
						dueDate: moment(task.dueDate).add(2, 'days').toDate(),
						isFulfilled: false,
					});

					break;
				}
				case TaskType.APPROVE_QUOTE: {
					if (!task.details.order) break;

					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order,
						'lab',
						'clinic',
						'dentist',
						'quoteDetails',
						'inquiry',
					);

					if (
						foundOrder &&
						foundOrder.quoteDetails.status === QuoteStatus.PENDING_APPROVAL
					) {
						const foundLabAdmins = await UserRepo.getAllLabAdmins(
							extractObjectId(foundOrder.lab),
						);

						foundLabAdmins.forEach((labAdmin: User) => {
							const templateData = {
								RecipientName: labAdmin.name,
							};

							notificationQueue.add('sendNotification', {
								_id: new Types.ObjectId(),
								type: NotificationType.APPROVE_PRESENTATION,
								description: templateManager.getTemplate(
									TemplateName.remindQuoteApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.NOTIFICATION,
									templateData,
								),
								whatsapp: templateManager.getTemplate(
									TemplateName.remindQuoteApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.WHATSAPP,
									templateData,
								),
								email: templateManager.getTemplate(
									TemplateName.remindQuoteApproval,
									RoleCode.LAB_ADMIN,
									TemplateType.EMAIL,
									templateData,
								),
								user: labAdmin._id,
								associatedId: foundOrder._id,
								associatedType: AssociatedType.ORDER,
								isRead: false,
							});
						});
					}
					break;
				}
				case TaskType.RECEIVE_ORDER: {
					if (!task.details.order) break;
					if (!task.details.subOrder) break;

					const foundOrder = await OrderRepo.findFieldsById(
						task.details.order,
						'lab',
						'clinic',
						'dentist',
						'inquiry',
						'deliveries',
						'patient',
					);

					if (!foundOrder) break;

					const foundSubOrder = foundOrder.deliveries.find(
						(delivery) =>
							delivery._id.toString() === task.details.subOrder?.toString(),
					);

					if (
						foundSubOrder &&
						foundSubOrder.status === OrderStatus.IN_SHIPMENT
					) {
						const foundDentist = await UserRepo.findFieldsById(
							extractObjectId(foundOrder.dentist),
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
							type: NotificationType.RECEIVE_ORDER,
							description: templateManager.getTemplate(
								TemplateName.remindReceiveOrder,
								RoleCode.DENTIST,
								TemplateType.NOTIFICATION,
								templateData,
							),
							whatsapp: templateManager.getTemplate(
								TemplateName.remindReceiveOrder,
								RoleCode.DENTIST,
								TemplateType.WHATSAPP,
								templateData,
							),
							email: templateManager.getTemplate(
								TemplateName.remindReceiveOrder,
								RoleCode.DENTIST,
								TemplateType.EMAIL,
								templateData,
							),
							user: foundOrder.dentist,
							associatedId: foundOrder._id,
							associatedType: AssociatedType.ORDER,
							isRead: false,
						});
					}

					break;
				}
				default:
					break;
			}

			await TaskRepo.fulfill(task._id);
		}
	} catch (error) {
		console.log(error);
		Logger.error(error);
	}
	// {
	// 	scheduled: true,
	// 	timezone: 'Your/Timezone',
	// },
});
