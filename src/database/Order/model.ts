import { Schema, model, Types } from 'mongoose';
import User from '../User/model';
import Lab from '../Lab/model';
import Clinic from '../Clinic/model';
import Inquiry from '../Inquiry/model';
import { ProductType } from '../Inquiry/types';

export const DOCUMENT_NAME = 'Order';
export const COLLECTION_NAME = 'orders';

export enum CaseComplexity {
	SIMPLE = 'SIMPLE',
	MODERATE = 'MODERATE',
	COMPLEX = 'COMPLEX',
}

export enum QuoteStatus {
	PENDING = 'PENDING',
	REWORK = 'REWORK',
	PENDING_APPROVAL = 'PENDING_APPROVAL',
	ADMIN_APPROVED = 'ADMIN_APPROVED',
	ADMIN_CANCELED = 'ADMIN_CANCELED',
	DENTIST_REVIEWED = 'DENTIST_REVIEWED',
	DENTIST_APPROVED = 'DENTIST_APPROVED',
	DENTIST_CANCELED = 'DENTIST_CANCELED',
}

export enum OrderStatus {
	PENDING = 'PENDING',
	DENTIST_APPROVED = 'DENTIST_APPROVED',
	PRODUCTION_PENDING = 'PRODUCTION_PENDING',
	DELIVERY_PENDING = 'DELIVERY_PENDING',
	IN_SHIPMENT = 'IN_SHIPMENT',
	DELIVERED = 'DELIVERED',
}

export enum DeliveryType {
	SELF = 'SELF',
	FEDEX = 'FEDEX',
	DHL = 'DHL',
}

export interface Delivery {
	_id: Types.ObjectId;
	prodType: ProductType;
	dentist: Types.ObjectId | User;
	productionManager: Types.ObjectId | User | null;
	deliveryCoordinator: Types.ObjectId | User | null;
	productionEstimationDate: Date | null;
	totalAligners: number;
	status: OrderStatus;
	deliveryDetails: {
		deliveryType: DeliveryType;
		trackingId?: string;
	};
}

export interface QuoteHistory {
	caseComplexity: CaseComplexity;
	totalAligners: number;
	price: number;
	note: string;
	reworkNote: string;
	presentationFolder: string;
	presentationPdf: string;
	isRevision: boolean;
	revisionNote: string;
	submitDate: Date;
}

export default interface Order {
	_id: Types.ObjectId;
	inquiry: Inquiry | Types.ObjectId;
	lab: Lab | Types.ObjectId;
	clinic: Clinic | Types.ObjectId;
	patient: User | Types.ObjectId;
	dentist: User | Types.ObjectId;
	isDeleted: boolean;
	productionId: Types.ObjectId | null;
	stage: string;
	quoteDetails: {
		caseComplexity: CaseComplexity;
		totalAligners: number;
		price: number;
		note: string;
		reworkNote: string;
		presentationFolder: string;
		presentationPdf: string;
		status: QuoteStatus;
		isRevision: boolean;
		revisionNote: string;
	};
	quoteHistory: QuoteHistory[];
	approvedDate: Date;
	deliveries: Delivery[];
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Order>(
	{
		inquiry: {
			type: Schema.Types.ObjectId,
			ref: 'Inquiry',
			required: true,
		},
		lab: {
			type: Schema.Types.ObjectId,
			ref: 'Lab',
			required: true,
		},
		clinic: {
			type: Schema.Types.ObjectId,
			ref: 'Clinic',
			required: true,
		},
		patient: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		dentist: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		productionId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		stage: {
			type: Schema.Types.String,
			default: '',
		},
		isDeleted: {
			type: Schema.Types.Boolean,
			default: false,
		},
		quoteDetails: {
			caseComplexity: {
				type: Schema.Types.String,
				enum: Object.values(CaseComplexity),
			},
			totalAligners: {
				type: Schema.Types.Number,
				required: true,
				min: [1, 'Mininum value is 1'],
			},
			price: {
				type: Schema.Types.Number,
			},
			note: {
				type: Schema.Types.String,
				default: '',
			},
			reworkNote: {
				type: Schema.Types.String,
				default: '',
			},
			presentationFolder: {
				type: Schema.Types.String,
				required: true,
			},
			presentationPdf: {
				type: Schema.Types.String,
				required: true,
			},
			status: {
				type: Schema.Types.String,
				enum: Object.values(QuoteStatus),
			},
			isRevision: {
				type: Schema.Types.Boolean,
				default: false,
			},
			revisionNote: {
				type: Schema.Types.String,
				default: '',
			},
		},
		quoteHistory: {
			type: [
				{
					caseComplexity: {
						type: Schema.Types.String,
						enum: Object.values(CaseComplexity),
					},
					totalAligners: {
						type: Schema.Types.Number,
						required: true,
						min: [1, 'Mininum value is 1'],
					},
					price: {
						type: Schema.Types.Number,
					},
					note: {
						type: Schema.Types.String,
						default: '',
					},
					reworkNote: {
						type: Schema.Types.String,
						default: '',
					},
					presentationFolder: {
						type: Schema.Types.String,
						required: true,
					},
					presentationPdf: {
						type: Schema.Types.String,
						required: true,
					},
					isRevision: {
						type: Schema.Types.Boolean,
						default: false,
					},
					revisionNote: {
						type: Schema.Types.String,
						default: '',
					},
					submitDate: {
						type: Date,
					},
				},
			],
			default: [],
		},
		approvedDate: {
			type: Date,
			default: null,
		},
		deliveries: {
			type: [
				{
					dentist: {
						type: Schema.Types.ObjectId,
						ref: 'User',
						default: null,
					},
					prodType: {
						type: Schema.Types.String,
						enum: Object.values(ProductType),
					},
					productionManager: {
						type: Schema.Types.ObjectId,
						ref: 'User',
						default: null,
					},
					deliveryCoordinator: {
						type: Schema.Types.ObjectId,
						ref: 'User',
						default: null,
					},
					productionEstimationDate: {
						type: Schema.Types.Date,
						default: null,
					},
					totalAligners: {
						type: Schema.Types.Number,
						min: [1, 'Minimum value is 1'],
					},
					status: {
						type: Schema.Types.String,
						enum: Object.values(OrderStatus),
					},
					deliveryDetails: {
						deliveryType: {
							type: Schema.Types.String,
							enum: Object.values(DeliveryType),
						},
						trackingId: {
							type: Schema.Types.String,
							default: null,
						},
					},
				},
			],
			default: [],
		},
	},
	{
		timestamps: true,
	},
);

export const OrderModel = model<Order>(DOCUMENT_NAME, schema, COLLECTION_NAME);
