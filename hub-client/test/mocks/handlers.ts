import { SecuredRoom } from '@/store/rooms';
import { http, HttpResponse } from 'msw';

export const handlers = [
	http.get('http://test/_synapse/client/secured_rooms', () => {
		return HttpResponse.json(
			[
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
			],
			{ status: 200 },
		);
	}),

	http.post('http://test/_synapse/client/secured_rooms', async (request) => {
		const body = (await request.request.json()) as SecuredRoom;
		if (typeof body.room_name === 'undefined' || body.room_name === '' || typeof body.accepted === 'undefined' || body.accepted === ({} as SecuredRoom) || typeof body.type === 'undefined' || body.type !== 'ph.messages.restricted') {
			return HttpResponse.json({ errors: 'wrong params' }, { status: 400 });
		}
		return HttpResponse.json(
			{
				room_id: 'ID:' + body.room_name,
				room_name: body.room_name,
				accepted: body.accepted,
				user_txt: body?.user_txt,
				type: body.type,
			},
			{ status: 200 },
		);
	}),

	http.delete(/http:\/\/test\/_synapse\/client\/secured_rooms\/*/, async (request) => {
		const match = request.request.url.match(/.*room_id=(.*)\b/);
		if (match !== null && match[1] !== undefined) {
			const room_id = match[1];
			return HttpResponse.json({ deleted: 'ID:' + room_id }, { status: 200 });
		}
		return HttpResponse.json({ errors: 'wrong params' }, { status: 400 });
	}),
];
