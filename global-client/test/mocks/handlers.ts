import { http, HttpResponse } from 'msw';

export const handlers = [
	http.get('http://test/login', () => {
		sessionStorage.setItem('loggedIn', 'true');
		return new HttpResponse(null, { status: 200 });
	}),

	http.get('http://test/logout', () => {
		sessionStorage.setItem('loggedIn', 'false');
		return new HttpResponse(null, { status: 200 });
	}),

	http.get('http://test/bar/state', () => {
		if (sessionStorage.getItem('loggedIn')) {
			return HttpResponse.json(
				{
					theme: 'system',
					language: 'en',
					hubs: [{ hubId: 'TestHub0' }],
				},
				{
					headers: {
						'Set-Cookie': 'PHAccount.LoginTimestamp=1',
						'X-Custom-Header': 'yes',
					},
					status: 200,
				},
			);
		} else {
			return new HttpResponse(null, { status: 403 });
		}
	}),

	http.get('http://test/bar/hubs', () => {
		return HttpResponse.json(
			[
				{
					name: 'TestHub0',
					description: 'Test Hub Zero',
					client_uri: 'http://hubtest0',
				},
				{
					name: 'TestHub1',
					description: 'Test Hub One',
					client_uri: 'http://hubtest1',
				},
				{
					name: 'TestHub2',
					description: 'Test Hub Two',
					client_uri: 'http://hubtest2',
				},
			],
			{ status: 200 },
		);
	}),
];
