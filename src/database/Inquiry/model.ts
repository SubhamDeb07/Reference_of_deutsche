import { Schema, model, Types } from 'mongoose';
import User from '../User/model';
import Lab from '../Lab/model';
import Clinic from '../Clinic/model';
import Order, { DeliveryType, QuoteStatus } from '../Order/model';
import { ProductType } from './types';

export const DOCUMENT_NAME = 'Inquiry';
export const COLLECTION_NAME = 'inquiries';

export enum ArchSide {
	UPPER = 'UPPER',
	LOWER = 'LOWER',
	DUAL = 'DUAL',
}

export enum ImpressionType {
	PHYSICAL = 'PHYSICAL',
	SOFT_COPY = 'SOFT_COPY',
}

export enum ImpressionStatus {
	NONE = 'NONE',
	PENDING = 'PENDING',
	IN_PROGRESS = 'IN_PROGRESS',
	DELIVERED = 'DELIVERED',
}

export enum Anterior {
	MAINTAIN_CURRENT_RELATION = 'MAINTAIN_CURRENT_RELATION',
	IMPROVE_CANINE_RELATION = 'IMPROVE_CANINE_RELATION',
	IMPROVE_CANINE_MOLAR_RELATION = 'IMPROVE_CANINE_MOLAR_RELATION',
}

export enum OverJet {
	SHOW_OVER_JET_POST_ALIGNMENT = 'SHOW_OVER_JET_POST_ALIGNMENT',
	MAINTAIN_OVER_JET = 'MAINTAIN_OVER_JET',
	IMPROVE_OVER_JET_IPR = 'IMPROVE_OVER_JET_IPR',
}

export enum OverBite {
	SHOW_OVER_JET_POST_ALIGNMENT = 'SHOW_OVER_JET_POST_ALIGNMENT',
	MAINTAIN_OVER_BITE = 'MAINTAIN_OVER_BITE',
	IMPROVE_OVER_BITE = 'IMPROVE_OVER_BITE',
}

export enum BiteRamps {
	AUTO = 'AUTO',
	LINGUAL_SIDE_UPPER = 'LINGUAL_SIDE_UPPER',
	NONE = 'NONE',
}

export enum MidLine {
	SHOW_MIDLINE_POST_ALIGNMENT = 'SHOW_MIDLINE_POST_ALIGNMENT',
	MAINTAIN_MIDLINE = 'MAINTAIN_MIDLINE',
	IMPROVE_MIDLINE_IPR = 'IMPROVE_MIDLINE_IPR',
}

export enum Spacing {
	CLOSE_ALL = 'CLOSE_ALL',
	MAINTAIN_MIDLINE = 'MAINTAIN_MIDLINE',
	NONE = 'NONE',
}

export type NotificationsType = 'WHATSAPP' | 'EMAIL';

// Define the Inquiry interface

export interface IprTooth {
	position: number;
	space: number;
}

export default interface Inquiry {
	_id: Types.ObjectId;
	prodType: ProductType;
	patient: User | Types.ObjectId;
	dentist: User | Types.ObjectId;
	treatmentPlanner: User | Types.ObjectId | null;
	archSide: ArchSide;
	impressionType: ImpressionType;
	impressionFiles: string[];
	impressionStatus: ImpressionStatus;
	impressionRecievedBy: User | Types.ObjectId | null;
	quoteStatus: QuoteStatus;
	isDeleted: boolean;
	quoteEstimationDate: Date | null;
	externalImages: string[];
	treatmentDetails: {
		restrictedTooth: number[];
		extractedTooth: number[];
		iprTooth: IprTooth[];
		note?: string;
		anterior?: Anterior;
		overJet?: OverJet;
		overBite?: OverBite;
		biteRamps?: BiteRamps;
		midLine?: MidLine;
		spacing?: Spacing;
		spacingCrowding?: number[];
	};
	lab: Lab | Types.ObjectId;
	clinic: Clinic | Types.ObjectId;
	order: Order | Types.ObjectId | null;
	deliveryDetails: {
		service: DeliveryType;
		trackingId?: string;
	};
	notificationsType: NotificationsType[];
	createdAt?: Date;
	updatedAt?: Date;
}

const schema = new Schema<Inquiry>(
	{
		prodType: {
			type: String,
			enum: Object.values(ProductType),
			required: true,
		},
		patient: {
			type: Types.ObjectId,
			ref: 'User',
			required: true,
		},
		dentist: {
			type: Types.ObjectId,
			ref: 'User',
			required: true,
		},
		treatmentPlanner: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		archSide: {
			type: String,
			enum: Object.values(ArchSide),
		},
		impressionType: {
			type: String,
			enum: Object.values(ImpressionType),
			required: true,
		},
		impressionFiles: [String],
		impressionStatus: {
			type: Schema.Types.String,
			enum: Object.values(ImpressionStatus),
			default: ImpressionStatus.PENDING,
		},
		deliveryDetails: {
			service: {
				type: Schema.Types.String,
				enum: Object.values(DeliveryType),
				default: DeliveryType.SELF,
			},
			trackingId: {
				type: Schema.Types.String,
				default: null,
			},
		},
		impressionRecievedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		quoteStatus: {
			type: Schema.Types.String,
			enum: Object.values(QuoteStatus),
			default: QuoteStatus.PENDING,
		},
		isDeleted: {
			type: Schema.Types.Boolean,
			default: false,
		},
		quoteEstimationDate: {
			type: Schema.Types.Date,
			default: null,
		},
		externalImages: [String],
		treatmentDetails: {
			restrictedTooth: [Number],
			extractedTooth: [Number],
			iprTooth: [
				{
					position: {
						type: Number,
					},
					space: {
						type: Number,
					},
					_id: false,
				},
			],
			note: String,
			anterior: {
				type: String,
				enum: Object.values(Anterior),
			},
			overJet: {
				type: String,
				enum: Object.values(OverJet),
			},
			overBite: {
				type: String,
				enum: Object.values(OverBite),
			},
			biteRamps: {
				type: String,
				enum: Object.values(BiteRamps),
			},
			midLine: {
				type: String,
				enum: Object.values(MidLine),
			},
			spacing: {
				type: String,
				enum: Object.values(Spacing),
			},
			spacingCrowding: [Number],
		},
		order: {
			type: Schema.Types.ObjectId,
			ref: 'Order',
			default: null,
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
		notificationsType: {
			type: [
				{
					type: Schema.Types.String,
					enum: ['WHATSAPP', 'EMAIL'],
				},
			],
		},
	},
	{
		timestamps: true,
	},
);

export const InquiryModel = model<Inquiry>(
	DOCUMENT_NAME,
	schema,
	COLLECTION_NAME,
);
