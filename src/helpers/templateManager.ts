import { RoleCode } from '../database/Role/model';
export interface TemplateData {
	[key: string]: string;
}

export enum TemplateName {
	quoteApproved = 'quoteApproved',
	quoteSentToRework = 'quoteSentToRework',
	remindReviewQuote = 'remindReviewQuote',
	remindImpressionPending = 'remindImpressionPending',
	impressionReceived = 'impressionReceived',
	directOrderPlaced = 'directOrderPlaced',
	orderPlaced = 'orderPlaced',
	orderApproved = 'orderApproved',
	orderManufacturing = 'orderManufacturing',
	orderShipped = 'orderShipped',
	orderDelivered = 'orderDelivered',
	privilegeUpdated = 'privilegeUpdated',
	treatmentEstimationProvided = 'treatmentEstimationProvided',
	productionEstimationProvided = 'productionEstimationProvided',
	remindPayout = 'remindPayout',
	paymentUpdated = 'paymentUpdated',
	remindApproveOrder = 'remindApproveOrder',
	dentistAdded = 'dentistAdded',
	dentistAddedByDentist = 'dentistAddedByDentist',
	clinicUpdated = 'clinicUpdated',
	remindDentistApproval = 'remindDentistApproval',
	remindReceiveOrder = 'remindReceiveOrder',
	remindQuoteApproval = 'remindQuoteApproval',
	remindSetTreatmentEstimation = 'remindSetTreatmentEstimation',
	remindQuoteDue = 'remindQuoteDue',
	remindProductionDue = 'remindProductionDue',
	productionOverDue = 'productionOverDue',
	assignedTreatmentPlanner = 'assignedTreatmentPlanner',
	assignedProductionManager = 'assignedProductionManager',
	assignedDeliveryCoordinator = 'assignedDeliveryCoordinator',
	remindSetProductionEstimation = 'remindSetProductionEstimation',
	remindShipOrder = 'remindShipOrder',
}

export enum TemplateType {
	NOTIFICATION = 'NOTIFICATION',
	EMAIL = 'EMAIL',
	WHATSAPP = 'WHATSAPP',
}

export interface EmailTemplate {
	subject: string;
	body: string;
}

export type Templates = {
	[templateName in TemplateName]: {
		[role in RoleCode]?: {
			[TemplateType.NOTIFICATION]?: string;
			[TemplateType.WHATSAPP]?: string;
			[TemplateType.EMAIL]?: EmailTemplate;
		};
	};
};

export enum TemplateField {
	DentistName = '[DentistName]',
	PatientId = '[PatientId]',
	RecipientName = '[RecipientName]',
	PortalName = '[PortalName]',
	DueAmount = '[DueAmount]',
	ClinicName = '[ClinicName]',
	TreatmentPlannerName = '[TreatmentPlannerName]',
	ProductionManagerName = '[ProductionManagerName]',
	DeliveryCoordinator = '[DeliveryCoordinator]',
}

export default class TemplateManager {
	private templates: Templates;

	constructor() {
		this.templates = {
			[TemplateName.quoteApproved]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your custom aligner quote, as requested for Patient ID ${TemplateField.PatientId}, is now ready for review.`,
					[TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\n\nThe custom aligner quote for Patient ID ${TemplateField.PatientId} is now prepared and ready for your review. Please access our Dental Portal to view the detailed quote. We appreciate your attention to providing the best care for our patients.\n\nFor any queries or further assistance, feel free to Contact us.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Aligner Quote Ready for Patient ID ${TemplateField.PatientId}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe are pleased to inform you that the custom aligner quote you requested for Patient ID ${TemplateField.PatientId} is now complete and ready for your review. TemplateField quote has been tailored to meet the specific needs of your patient and is available through our Dental Portal.\n\nIf you have any questions or require additional information, please contact us.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.TREATMENT_PLANNER]: {
					[TemplateType.NOTIFICATION]: `Your Presentation has been approved by the admin.`,
					[TemplateType.EMAIL]: {
						subject: 'Presentation Approved by Admin',
						body: `Dear ${TemplateField.RecipientName},\n\nWe are pleased to inform you that your presentation has been approved by the admin.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Presentation Approved\n\nHi ${TemplateField.RecipientName},\n\nGood news! Your presentation has been approved by the admin.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.quoteSentToRework]: {
				[RoleCode.TREATMENT_PLANNER]: {
					[TemplateType.NOTIFICATION]: `Admin has provided feedback. Rework required.`,
					[TemplateType.EMAIL]: {
						subject: 'Feedback Received: Rework Required',
						body: `Rework Alert: Admin Feedback\n\nDear ${TemplateField.RecipientName},\n\nThe admin has provided feedback on your recent submission. Rework is required to meet the necessary standards. Please review the feedback and proceed accordingly.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nThe admin has reviewed your work and provided feedback. Rework is required. Please check the details.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.remindReviewQuote]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]:
						'You have pending aligner quotes from 2 days ago awaiting review.',
					[TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\n\nWe'd like to remind you that aligner quotes from 2 days ago awaiting review in our Dental Portal. Please check them at your earliest convenience. Thank you.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Aligner Quote Review Reminder',
						body: `Dear ${TemplateField.RecipientName},\n\nA quick reminder: Aligner quotes from 2 days ago are awaiting your review in our Dental Portal. Please check them at your earliest convenience. Thank you.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindImpressionPending]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your patient's aligner impression for Patient ID ${TemplateField.PatientId} is pending. Please deliver the impression to receive your quote.`,
					[TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\n\nJust a reminder: The aligner impression for Patient ID ${TemplateField.PatientId} is pending. Please submit it to receive your quote. Thanks!\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Pending Aligner Impression for Patient ID ${TemplateField.PatientId}`,
						body: `Dear ${TemplateField.RecipientName},\n\nJust a reminder: The aligner impression for Patient ID ${TemplateField.PatientId} is pending. Please submit the impression to proceed with the quote.\n\nThank you for your prompt attention to TemplateField matter.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.impressionReceived]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `We've received the dental impression for Patient ID ${TemplateField.PatientId}. A custom quote is coming soon.`,
					[TemplateType.WHATSAPP]: `Hello Dr. ${TemplateField.RecipientName},\n\nWe've received the dental impression for Patient ID ${TemplateField.PatientId}. A custom quote will be provided soon.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Dental Impression Received - Patient ID ${TemplateField.PatientId}`,
						body: `Dear Dr. ${TemplateField.RecipientName},\n\nGood news! We've received the dental impression for Patient ID ${TemplateField.PatientId}. A custom quote is being prepared and will be sent to you soon. Stay tuned!\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.TREATMENT_PLANNER]: {
					[TemplateType.NOTIFICATION]: `An impression has been delivered to the lab.`,
					[TemplateType.EMAIL]: {
						subject: 'Impression Delivered to Lab',
						body: `Dear ${TemplateField.RecipientName},\n\nThis notification is to inform you that an impression has been delivered to the lab. You may review the relevant details at your convenience.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Lab Delivery Update\n\nHi ${TemplateField.RecipientName},\n\nAn impression has been delivered to the lab. Please check for further details.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.directOrderPlaced]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your direct order for Patient ID ${TemplateField.PatientId} has been successfully placed. We will update you on the progress soon.`,
					[TemplateType.WHATSAPP]: `Hello Dr. ${TemplateField.RecipientName},\n\nYour order has been placed successfully. We'll keep you posted on the progress soon.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Confirmation: Order Placed for Patient ID ${TemplateField.PatientId}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe are pleased to inform you that your direct order for Patient ID ${TemplateField.PatientId} has been successfully placed with us. Our team is now working diligently to process your order. We value your trust and will keep you informed about the progress and expected completion timeline soon.\n\nThank you for choosing our services. Should you have any questions, please don't hesitate to reach out.\n\nWarm regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.DentistName} has directly placed a new order.`,
					[TemplateType.WHATSAPP]: `🌟 New Direct Order Alert\n\nHi ${TemplateField.RecipientName},\n\n${TemplateField.DentistName} has just placed a new direct order. Please take a moment to review it.`,
					[TemplateType.EMAIL]: {
						subject: `New Direct Order from ${TemplateField.DentistName}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe're pleased to inform you that ${TemplateField.DentistName} has directly placed a new order with us. Kindly review the order details in our system.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.orderPlaced]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your aligner order for Patient ID ${TemplateField.PatientId} has been sent for admin approval.`,
					[TemplateType.WHATSAPP]: `Hello Team,\n\nThe aligner order for Patient ID ${TemplateField.PatientId} is now under admin review. You will be notified when it's approved.\n\nCheers,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Aligner Order Sent for Approval - Patient ID ${TemplateField.PatientId}`,
						body: `Dear Team,\n\nThe aligner order for Patient ID ${TemplateField.PatientId} has been submitted for admin approval. You will be notified once it's approved.\n\nCheers,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.DentistName} has placed an order. Please review and approve.`,
					[TemplateType.WHATSAPP]: `📋 New Order Alert: ${TemplateField.DentistName}\n\nHi ${TemplateField.RecipientName},\n\nJust in: An order has been placed by ${TemplateField.DentistName}. Kindly review and approve.`,
					[TemplateType.EMAIL]: {
						subject: `Order from ${TemplateField.DentistName} Awaiting Approval`,
						body: `Dear ${TemplateField.RecipientName},\n\n${TemplateField.DentistName} has placed an order. Please review and approve it at your earliest convenience.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.orderApproved]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your order for Patient ID ${TemplateField.PatientId} has been approved and is now being processed for production.`,
					[TemplateType.WHATSAPP]: `Hello Dr. ${TemplateField.RecipientName},\n\nGreat news! Your order for Patient ID ${TemplateField.PatientId} has been approved. We are now processing it for production. We will keep you updated on the status.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Order Approved for Patient ID ${TemplateField.PatientId}',
						body: `Dear Dr. ${TemplateField.RecipientName},\n\nYour order for Patient ID ${TemplateField.PatientId} has been approved and is now being processed. We're excited to move forward with the production and will keep you updated on the progress.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.orderManufacturing]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your aligner order for Patient ID ${TemplateField.PatientId} is currently being manufactured.`,
					[TemplateType.WHATSAPP]: `Hello Dr. ${TemplateField.RecipientName},\n\nThe aligner order for Patient ID ${TemplateField.PatientId} is now being manufactured. Stay tuned for further updates!\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Aligner Order in Manufacturing - Patient ID ${TemplateField.PatientId}`,
						body: `Hello Dr. ${TemplateField.RecipientName},\n\nWe are pleased to inform you that the aligner order for Patient ID ${TemplateField.PatientId} is currently in the manufacturing stage.\n\nWe'll update you on the next steps soon.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.orderShipped]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your aligner order for Patient ID ${TemplateField.PatientId} has been shipped.`,
					[TemplateType.WHATSAPP]: `Hello Dr. ${TemplateField.RecipientName},\n\nYour aligner order for Patient ID ${TemplateField.PatientId} is on its way! We'll notify you upon its arrival.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject:
							'Aligner Order Shipped - Patient ID ${TemplateField.PatientId}',
						body: `Hello Dr. ${TemplateField.RecipientName},\n\nGood news! The aligner order for Patient ID ${TemplateField.PatientId} has been shipped.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.orderDelivered]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Your aligner order for Patient ID ${TemplateField.PatientId} has been delivered.`,
					[TemplateType.WHATSAPP]: `Hi Team,\n\nThe aligner order for Patient ID ${TemplateField.PatientId} has been delivered.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Aligner Order Delivered - Patient ID ${TemplateField.PatientId}`,
						body: `Hello Dr. ${TemplateField.RecipientName},\n\nWe're happy to announce that the aligner order for Patient ID ${TemplateField.PatientId} has been successfully delivered.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.DELIVERY_COORDINATOR]: {
					[TemplateType.NOTIFICATION]: `An order has been successfully delivered to the clinic.`,
					[TemplateType.EMAIL]: {
						subject: `Successful Delivery of Order: Patient ID ${TemplateField.PatientId}`,
						body: `Hi ${TemplateField.RecipientName},\n\nJust a quick update: The order associated with Patient ID ${TemplateField.PatientId} has been successfully delivered to the clinic.`,
					},
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nGood news! The order for Patient ID: ${TemplateField.PatientId} has been successfully delivered to the clinic. 🎉`,
				},
			},
			[TemplateName.privilegeUpdated]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]:
						'Your user permissions have been updated by admin.',
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nYour user permissions have been updated by the admin. Check out the new changes by logging in!\n\nBest,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'User Permissions Updated',
						body: `Dear ${TemplateField.RecipientName},\n\nTemplateField is to inform you that your user permissions have been updated by the admin. Please log in to view the changes.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.treatmentEstimationProvided]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `The lab has provided a time estimate for the treatment plan of Patient ID ${TemplateField.PatientId}.`,
					[TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\n\nJust a heads-up: We've provided a time estimate for the treatment plan of Patient ID ${TemplateField.PatientId}. Please log in to the portal for full details.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Time Estimate for Treatment Plan - Patient ID ${TemplateField.PatientId}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe have provided a time estimate for the treatment plan associated with Patient ID ${TemplateField.PatientId}. Please log in to the portal for full details.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.productionEstimationProvided]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Lab provided a time estimate for the order associated with Patient ID ${TemplateField.PatientId}.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nQuick update: Time estimate for Order ID ${TemplateField.PatientId} is now available. Please log in to the portal for full details.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Order Time Estimate - Patient ID ${TemplateField.PatientId}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe've provided a time estimate for the order linked to Patient ID ${TemplateField.PatientId}. Please log in to the portal for full details.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindPayout]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.DueAmount} available for payout. Please clear the payment.`,
					[TemplateType.WHATSAPP]: `💳 Payment Alert: ${TemplateField.DueAmount} Payout\n\nHi ${TemplateField.RecipientName},\n\nWe have ${TemplateField.DueAmount} ready for payout. Please process TemplateField payment at your earliest convenience.\n\nIf you need any assistance, we're here to help.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Payout Available - Action Required',
						body: `Dear Dr. ${TemplateField.RecipientName},\n\nWe are writing to inform you that there is an amount of ${TemplateField.DueAmount} available for payout.\n\nTo facilitate smooth financial operations, we kindly request you to clear TemplateField payment at your earliest convenience. \n\nFor any queries or assistance regarding the payment process, please feel free to contact us.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.paymentUpdated]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: 'Admin has revised your payout balance.',
					[TemplateType.WHATSAPP]: `🔄 Payout Balance Revision Alert\n\nHi ${TemplateField.RecipientName},\n\nQuick heads-up: The LAB Admin has revised your payout balance. Please check your account for the updated details.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Update on Your Payout Balance',
						body: `Dear ${TemplateField.RecipientName},\n\nTemplateField is to notify you that the LAB Admin has revised your payout balance. We encourage you to review the updated figures at your earliest convenience.\n\nPlease log in to Portal for detailed information.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindApproveOrder]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.DentistName}'s order from 2 days ago requires your attention.`,
					[TemplateType.WHATSAPP]: `🔔 Urgent: ${TemplateField.DentistName}'s Pending Order\n\nHi ${TemplateField.RecipientName},\n\n${TemplateField.DentistName}'s order from 2 days ago still requires your attention. Please review it as soon as possible to ensure timely processing.`,
					[TemplateType.EMAIL]: {
						subject: `Urgent: Review ${TemplateField.DentistName}'s Order`,
						body: `Dear ${TemplateField.RecipientName},\n\nPlease review ${TemplateField.DentistName}'s order from 2 days ago. Your prompt action is needed.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.dentistAdded]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `A new dentist, ${TemplateField.DentistName}, has been added to your clinic account. Set their permissions in the portal.`,
					[TemplateType.EMAIL]: {
						subject: 'New Dentist Added to Clinic Account',
						body: `Dear ${TemplateField.RecipientName},\n\nWe would like to inform you that a new dentist, ${TemplateField.DentistName}, has been added to your clinic account. Kindly set their permissions in the portal at your earliest convenience.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `🔔 Clinic Account Update\n\nHi ${TemplateField.RecipientName},\n\nA new dentist, ${TemplateField.DentistName}, has been added to your clinic account. Please set their permissions in the portal.`,
				},
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Approval Required: New Dentist Account Request from ${TemplateField.ClinicName}.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nThere's a new dentist account request from ${TemplateField.ClinicName} awaiting your approval. Please review and respond.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject:
							'Approval Needed for New Dentist Account from [Clinic Name]',
						body: `Dear ${TemplateField.RecipientName},\n\nWe have received a new dentist account request from ${TemplateField.ClinicName}. Your approval is required to proceed.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.clinicUpdated]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Your clinic details have been updated by the authorized team member, ${TemplateField.DentistName}.`,
					[TemplateType.WHATSAPP]: `🔄 Clinic Update Alert\n\nHi ${TemplateField.RecipientName},\n\nYour clinic details have been updated by the authorized team member, ${TemplateField.DentistName}. Please review the changes in the portal.\n\nBest regards,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `Clinic Details Updated by ${TemplateField.DentistName}`,
						body: `Dear ${TemplateField.RecipientName},\n\nTemplateField is to inform you that ${TemplateField.DentistName} has recently updated your clinic details. We recommend reviewing these changes in the portal to ensure accuracy.\n\nThank you,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.dentistAddedByDentist]: {
				[RoleCode.DENTIST_ADMIN]: {
					[TemplateType.NOTIFICATION]: `A team member, ${TemplateField.DentistName}, has added a dentist. Please review the changes.`,
					[TemplateType.WHATSAPP]: `📌 Clinic Update\n\nHi ${TemplateField.RecipientName},\n\n[Team Member] has added a new dentist to your clinic. Please review the changes in the portal.\n\nCheers,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: `New Dentist Added by ${TemplateField.DentistName}`,
						body: `Dear ${TemplateField.RecipientName},\n\nWe want to inform you that ${TemplateField.DentistName} has recently added a new dentist to your clinic. We recommend reviewing TemplateField update in the portal for accuracy and completeness.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindDentistApproval]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Pending Approval: Dentist Account Request from ${TemplateField.ClinicName}`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nA dentist account request from ${TemplateField.ClinicName} is still pending approval. Please review and respond.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Pending Approval for Dentist Account from [Clinic Name]',
						body: `Dear ${TemplateField.RecipientName},\n\nThis is a reminder that a dentist account request from ${TemplateField.ClinicName} is awaiting your approval.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindQuoteApproval]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Inquiry Approval Pending from last 2 days`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nJust a heads-up: A treatment plan has been awaiting your approval for the last 2 days. Please review.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Treatment Plan Awaiting Approval',
						body: `Dear ${TemplateField.RecipientName},\n\nA treatment plan has been awaiting your approval for 2 days. Please review it promptly in the portal.\n\nRegards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindSetTreatmentEstimation]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.TreatmentPlannerName} has not yet accepted the assigned treatment inquiry.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nJust a reminder: ${TemplateField.TreatmentPlannerName}'s treatment inquiry is still awaiting a response. Kindly check and expedite.\n\nBest,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Urgent: Assigned Treatment Inquiry Pending',
						body: `Dear ${TemplateField.RecipientName},\n\nWe would like to inform you that ${TemplateField.TreatmentPlannerName} has not yet accepted the assigned treatment inquiry. Prompt action is needed to maintain workflow efficiency.\n\nKindly address this as soon as possible.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.remindQuoteDue]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Treatment plan presentation is overdue.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nReminder: The treatment plan presentation assigned to ${TemplateField.TreatmentPlannerName} is overdue. Please address this as soon as possible.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject: 'Urgent: Overdue Treatment Plan Presentation',
						body: `Dear ${TemplateField.RecipientName},\n\nWe would like to bring to your attention that the treatment plan presentation is currently overdue. Prompt action is needed.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.TREATMENT_PLANNER]: {
					[TemplateType.NOTIFICATION]: `A query from 2 days ago is still pending. Immediate attention needed.`,
					[TemplateType.EMAIL]: {
						subject: 'Urgent: Pending Query from 2 Days Ago',
						body: `Dear ${TemplateField.RecipientName},\n\nA query submitted 2 days ago remains pending. Please address this matter promptly.\n\nRegards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nA query from 2 days ago is still pending. Immediate attention is required.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.remindProductionDue]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `${TemplateField.ProductionManagerName}: Order deadline is approaching.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nSystem alert: The deadline for the order assigned to ${TemplateField.ProductionManagerName} is nearing. Please review the progress.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject:
							"System Alert: Deadline Approaching for [Production Manager Name]'s Order",
						body: `Dear ${TemplateField.RecipientName},\n\nThis is an automatic update to inform you that the deadline for the order overseen by ${TemplateField.ProductionManagerName} is approaching. We recommend checking in for a status update.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.PRODUCTION_MANAGER]: {
					[TemplateType.NOTIFICATION]: `A deadline for the current production batch is approaching.`,
					[TemplateType.EMAIL]: {
						subject: 'Reminder: Production Batch Deadline',
						body: `Dear ${TemplateField.RecipientName},\n\nThe deadline for our current production batch is approaching. Please ensure timely completion.\n\nRegards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Deadline Reminder: Current Production Batch\n\nHi ${TemplateField.RecipientName},\n\nThe deadline for our current production batch is nearing. Please check the progress and ensure we're on schedule.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.productionOverDue]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Production Manager ${TemplateField.ProductionManagerName} has not completed the order, and the deadline has passed.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nSystem update: ${TemplateField.ProductionManagerName} has not completed the order and the deadline has passed. Immediate attention is required.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject:
							'System Alert: Missed Deadline by Production Manager [Production Manager Name]',
						body: `Dear ${TemplateField.RecipientName},\n\nThis is an automated notification to alert you that Production Manager ${TemplateField.ProductionManagerName} has not completed the order, and the deadline has now passed. Urgent action may be required to address this issue.\n\nRegards,\n${TemplateField.PortalName}`,
					},
				},
			},
			[TemplateName.assignedTreatmentPlanner]: {
				[RoleCode.TREATMENT_PLANNER]: {
					[TemplateType.NOTIFICATION]: `A new query has been received.`,
					[TemplateType.EMAIL]: {
						subject: 'Notification: New Query Received',
						body: `Dear ${TemplateField.RecipientName},\n\nWe would like to inform you that a new query has been received. Please review and address it.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nA new query has been received. Please check and respond.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.assignedProductionManager]: {
				[RoleCode.PRODUCTION_MANAGER]: {
					[TemplateType.NOTIFICATION]: `A new order has been received.`,
					[TemplateType.EMAIL]: {
						subject: 'Review Required: New Order Ready for Manufacturing',
						body: `Dear ${TemplateField.RecipientName},\n\nWe have a new order that requires your review. Please assess the details and start the manufacturing process to ensure timely execution.\n\nLooking forward to efficient progress.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Start Manufacturing: New Order Received\n\nHi ${TemplateField.RecipientName},\n\nWe've received a new order. Please review and initiate the manufacturing process. Let's ensure timely progress!\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.remindSetProductionEstimation]: {
				[RoleCode.PRODUCTION_MANAGER]: {
					[TemplateType.NOTIFICATION]: `Reminder: You have an order pending acceptance.`,
					[TemplateType.EMAIL]: {
						subject: 'Action Required: Order Awaiting Your Acceptance',
						body: `Dear ${TemplateField.RecipientName},\n\nWe would like to remind you that there is an order currently awaiting your acceptance. Please take a moment to address this at your earliest convenience.\n\nSincerely,\n${TemplateField.PortalName}`,
					},
					[TemplateType.WHATSAPP]: `Order Pending Acceptance\n\nHi ${TemplateField.RecipientName},\n\nJust a reminder: You have an order pending acceptance. Please review and take the necessary action soon.\n\nThanks,\n${TemplateField.PortalName}`,
				},
			},
			[TemplateName.assignedDeliveryCoordinator]: {
				[RoleCode.DELIVERY_COORDINATOR]: {
					[TemplateType.NOTIFICATION]: `A new order has been placed and is awaiting processing.`,
					[TemplateType.WHATSAPP]: `Hey ${TemplateField.RecipientName},\n\nOur latest order for Patient ID: ${TemplateField.PatientId} is prepped for delivery. Please start the dispatch process. Thanks!`,
					[TemplateType.EMAIL]: {
						subject: `Ready for Dispatch: Latest Order (Patient ID: ${TemplateField.PatientId})`,
						body: `Hi ${TemplateField.RecipientName},\n\nOur latest order, associated with Patient ID: ${TemplateField.PatientId}, is now ready and awaiting delivery processing. Please proceed with the necessary steps for dispatch.`,
					},
				},
			},
			[TemplateName.remindShipOrder]: {
				[RoleCode.LAB_ADMIN]: {
					[TemplateType.NOTIFICATION]: `Attention needed: Delivery Manager ${TemplateField.DeliveryCoordinator} has an outstanding order.`,
					[TemplateType.WHATSAPP]: `Hi ${TemplateField.RecipientName},\n\nSystem alert: Delivery Manager ${TemplateField.DeliveryCoordinator} has an outstanding order. Please review and take necessary action.\n\nThanks,\n${TemplateField.PortalName}`,
					[TemplateType.EMAIL]: {
						subject:
							'Action Required: Outstanding Order by Delivery Manager [Delivery Manager Name]',
						body: `Dear ${TemplateField.RecipientName},\n\nAn automated system notification indicates that Delivery Manager ${TemplateField.DeliveryCoordinator} has an outstanding order that requires your attention. Please assess the situation and take appropriate actions.\n\nBest regards,\n${TemplateField.PortalName}`,
					},
				},
				[RoleCode.DELIVERY_COORDINATOR]: {
					[TemplateType.NOTIFICATION]: `Reminder: An order is still awaiting dispatch. Please address immediately.`,
					[TemplateType.WHATSAPP]: `Hey ${TemplateField.RecipientName},\n\nJust a reminder: We still have an order for Patient ID: ${TemplateField.PatientId} awaiting dispatch. Please address this immediately. Thanks!`,
					[TemplateType.EMAIL]: {
						subject: `Immediate Action Required: Order for Patient ID: ${TemplateField.PatientId} Dispatch Pending`,
						body: `Hi ${TemplateField.RecipientName},\n\nJust a reminder: We have an order for Patient ID: ${TemplateField.PatientId} still pending dispatch. Please expedite.`,
					},
				},
			},
			[TemplateName.remindReceiveOrder]: {
				[RoleCode.DENTIST]: {
					[TemplateType.NOTIFICATION]: `Reminder: The order for Patient ID ${TemplateField.PatientId} has not been received yet. Please expedite the process.`,
					[TemplateType.WHATSAPP]: `Hello ${TemplateField.RecipientName},\n\nJust a reminder: Your order for Patient ID: ${TemplateField.PatientId} has been shipped but has yet to be received. Please expedite.`,
					[TemplateType.EMAIL]: {
						subject: `Immediate Action Required: Receive Order`,
						body: `Hello ${TemplateField.RecipientName},\n\njust a reminder: Your order for Patient ID: ${TemplateField.PatientId} has been shipped but has yet to be received. Please expedite.`,
					},
				},
			},
		};
	}

	getTemplate(
		templateName: TemplateName,
		role: RoleCode,
		type: TemplateType,
		data: TemplateData,
	): string {
		data.PortalName = 'Deutsche Aligners';
		const roleTemplates = this.templates[templateName][role];
		if (!roleTemplates) {
			throw new Error('No templates found for the specified role');
		}

		const template = roleTemplates[type];
		if (!template) {
			throw new Error('Template not found for the specified type');
		}

		if (type === TemplateType.EMAIL && typeof template === 'object') {
			const emailTemplate = template as EmailTemplate;
			return `Subject: ${this.fillTemplateWithData(
				emailTemplate.subject,
				data,
			)}\n\n${this.fillTemplateWithData(emailTemplate.body, data)}`;
		}

		return this.fillTemplateWithData(template as string, data);
	}

	fillTemplateWithData(template: string, data: TemplateData): string {
		return template.replace(/\[(\w+)\]/g, (_, key) => data[key] || `[${key}]`);
	}
}
