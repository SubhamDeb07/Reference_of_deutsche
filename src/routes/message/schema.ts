import Joi from 'joi';

export default {
	getAllByRoomId: Joi.object().keys({
		roomId: Joi.string().required(),
		page: Joi.number().min(1),
		limit: Joi.number().min(1),
	}),
};
