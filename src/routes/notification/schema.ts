import Joi from 'joi';

export default {
	GetNotification: Joi.object().keys({
		page: Joi.number().min(1).max(100).required(),
		limit: Joi.number().min(1).max(100).required(),
	}),
	MarkAsRead: Joi.object().keys({
		id: Joi.string().required(),
	}),
};
