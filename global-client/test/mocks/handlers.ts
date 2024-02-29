import { rest } from 'msw';

export const handlers = [
	rest.get('http://test/login', (req, res, ctx) => {
		sessionStorage.setItem('loggedIn', 'true');
		return res(ctx.status(200));
	}),

	rest.get('http://test/logout', (req, res, ctx) => {
		sessionStorage.setItem('loggedIn', 'false');
		return res(ctx.status(200));
	}),

	rest.get('http://test/bar/state', (req, res, ctx) => {
		if (sessionStorage.getItem('loggedIn')) {
			return res(
				ctx.status(200),
				ctx.cookie('PHAccount.LoginTimestamp', '1'),
				ctx.json({
					theme: 'system',
					language: 'en',
					hubs: [{ hubId: 'TestHub0' }],
				}),
			);
		} else {
			return res(ctx.status(403));
		}
	}),

	rest.get('http://test/bar/hubs', (req, res, ctx) => {
		return res(
			ctx.status(200),
			ctx.json([
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
			]),
		);
	}),
];
