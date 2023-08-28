import { SecuredRoom } from '@/store/rooms';
import { rest } from 'msw';

export const handlers = [
	rest.get('http://test/_synapse/client/secured_rooms', (req, res, ctx) => {
		return res(
			ctx.status(200),
			ctx.json([
				{
					room_name: 'Secured 1',
					accepted: {
						// "pbdf.sidn-pbdf.email.domain": {
						//     "accepted_values": [
						//         "ru.nl"
						//     ],
						//     "profile": true
						// }
					},
					user_txt: 'Lorum',
					type: 'ph.messages.restricted',
				},
				{
					room_name: 'Secured 2',
					accepted: {},
					user_txt: 'Ipsum',
					type: 'ph.messages.restricted',
				},
			]),
		);
	}),
	rest.post('http://test/_synapse/client/secured_rooms', async (req, res, ctx) => {
		const body = (await req.json()) as SecuredRoom;
		if (typeof body.room_name == 'undefined' || body.room_name == '' || typeof body.accepted == 'undefined' || body.accepted == ({} as SecuredRoom) || typeof body.type == 'undefined' || body.type !== 'ph.messages.restricted') {
			return res(ctx.status(400), ctx.json({ errors: 'wrong params' }));
		}
		return res(
			ctx.status(200),
			ctx.json({
				room_id: 'ID:' + body.room_name,
				room_name: body.room_name,
				accepted: body.accepted,
				user_txt: body?.user_txt,
				type: body.type,
			}),
		);
	}),
	rest.delete(/http:\/\/test\/_synapse\/client\/secured_rooms\/*/, async (req, res, ctx) => {
		const match = req.url.search.match(/.*room_id=(.*)\b/);
		if (match !== null && match[1] != undefined) {
			const room_id = match[1];
			return res(ctx.status(200), ctx.json({ deleted: 'ID:' + room_id }));
		}
		return res(ctx.status(400), ctx.json({ errors: 'wrong params' }));
	}),
];
