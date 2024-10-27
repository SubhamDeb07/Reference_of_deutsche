import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SuccessResponse } from '../../core/ApiResponse';
import { ProtectedRequest } from 'app-request';
import { BadRequestError } from '../../core/ApiError';
import validator, { ValidationSource } from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import authentication from '../../auth/authentication';
import OrderRepo from '../../database/Order/repo';
import { Types } from 'mongoose';
import { s3 } from '../../config/aws';
import { aws as awsConfig } from '../../config/index';

const router = express.Router();

/*-------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------*/

router.get(
	'/preSignedUrl',
	authentication,
	validator(schema.preSignedUrl, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { type, extension, fileName, folderName } = req.query; // PRESENTATION

		let bucketName = null;
		let fileStr = null;

		switch (type) {
			case 'PRESENTATION':
				bucketName = awsConfig.s3PresentationBucket;
				fileStr = `${folderName}/${fileName}.${extension}`;
				break;
			case 'ASSET':
				const randomString = uuidv4().replace(/-/g, '');
				bucketName = awsConfig.s3AssetsBucket;
				fileStr = `${randomString}.${extension}`;
			default:
				break;
		}

		if (!bucketName) throw new BadRequestError('Something went wrong');

		const params = {
			Bucket: bucketName as string,
			Key: fileStr as string,
			Expires: 360, // expires in 6mins
		};

		const presignedUrl = await s3.getSignedUrlPromise('putObject', params);

		return new SuccessResponse('success', { presignedUrl }).send(res);
	}),
);

router.get(
	'/getPresentationFiles',
	validator(schema.getFilesByFolder, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const data = await OrderRepo.findPresentationDetails(
			req.query.folderName as string,
		);

		const bucketName = awsConfig.s3PresentationBucket;
		const awsRegion = awsConfig.region;
		const folderName = req.query.folderName as string;

		if (!folderName) throw new BadRequestError('Folder name is required');

		if (!bucketName) throw new BadRequestError('Something went wrong');

		const params = {
			Bucket: bucketName,
			Prefix: folderName as string,
		};

		const files = await s3.listObjectsV2(params).promise();

		// const bucketUrl = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/`;
		const bucketUrl = `https://${bucketName}.s3-accelerate.amazonaws.com/`;

		const urls = files.Contents?.map((obj) => `${bucketUrl}${obj.Key}`);

		new SuccessResponse('success', {
			orderDetail: data,
			presentationFiles: urls,
		}).send(res);
	}),
);

router.delete(
	'/delete',
	authentication,
	validator(schema.deleteFile, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { objectKey } = req.query;

		const bucketName = awsConfig.s3AssetsBucket;
		const regex = /\/([^/]+)$/;
		const match = (objectKey as string).match(regex);

		const fileName = match ? match[1] : '';

		const params = {
			Bucket: bucketName as string,
			Key: fileName as string,
		};

		await s3.deleteObject(params).promise();

		return new SuccessResponse('File deleted', {}).send(res);
	}),
);

export default router;
