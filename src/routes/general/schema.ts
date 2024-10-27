import Joi from 'joi';

export default {
	preSignedUrl: Joi.object().keys({
		type: Joi.string().valid('ASSET', 'PRESENTATION').required(),
		folderName: Joi.when('type', {
			is: Joi.string().valid('PRESENTATION'),
			then: Joi.string().uuid().required(),
			otherwise: Joi.forbidden(),
		}),
		fileName: Joi.when('type', {
			is: Joi.string().valid('PRESENTATION'),
			then: Joi.string().min(4).required(),
			otherwise: Joi.forbidden(),
		}),
		extension: Joi.string().required(),
	}),
	deleteFile: Joi.object().keys({
		objectKey: Joi.string().uri().required(),
	}),
	getCountryById: Joi.object().keys({
		countryId: Joi.number().required().min(1),
	}),
	citiesByCountryId: Joi.object().keys({
		countryId: Joi.number().required().min(1),
	}),
	cityById: Joi.object().keys({
		cityId: Joi.number().required().min(1),
	}),
	getFilesByFolder: Joi.object().keys({
		folderName: Joi.string().min(14).required(),
	}),
};
