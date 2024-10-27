import express from 'express';
import { ProtectedRequest } from 'app-request';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import validator, { ValidationSource } from '../../helpers/validator';
import schema from './schema';
import { BadRequestError, ForbiddenError } from '../../core/ApiError';
import role from '../../helpers/role';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import ChatRoomRepo from '../../database/ChatRoom/repo';
import MessageRepo from '../../database/Message/repo';
import { RoleCode } from '../../database/Role/model';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication);
//----------------------------------------------------------------

router.get(
	'/',
	role(...Object.values(RoleCode)),
	authorization,
	validator(schema.getAllByRoomId, ValidationSource.QUERY),
	asyncHandler(async (req: ProtectedRequest, res) => {
		const { roomId, page = 1, limit = 20 } = req.query;

		const foundRoom = await ChatRoomRepo.findByRoomId(roomId as string);

		if (!foundRoom)
			throw new BadRequestError('Access to group chat is restricted.');

		if (
			foundRoom.users.findIndex((usr) => usr._id.equals(req.user._id)) === -1
		) {
			throw new ForbiddenError();
		}

		const messages = await MessageRepo.getMessagesByRoomIdWithPagination(
			roomId as string,
			+page,
			+limit,
		);

		new SuccessResponse('Success', messages.reverse()).send(res);
	}),
);

export default router;
