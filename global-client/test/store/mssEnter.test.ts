// Packages
import { server } from '../mocks/server';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';

// Models
import { type AttrType, loginMethods } from '@global-client/models/MSS/TAuths';
import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { EnterCancelled, useMSS } from '@global-client/stores/mss';

import { useSettings } from '@hub-client/stores/settings';

// The Yivi widget is stood in for, so a test decides when a session ends - and whether it ends
// because the store aborted it. Everything the store does around it is the real implementation.
const { yiviSessions } = vi.hoisted(() => ({
	yiviSessions: [] as {
		abort: ReturnType<typeof vi.fn>;
		resolve: (disclosure: string) => void;
		reject: (reason: unknown) => void;
		endOnFailure: boolean;
	}[],
}));

vi.mock('@global-client/logic/utils/yiviHandler', () => ({
	canOpenYiviApp: () => false,
	startYiviAuthentication: (_url: string, _request: string, _mountPoint: unknown, endOnFailure = false) => {
		let resolve!: (disclosure: string) => void;
		let reject!: (reason: unknown) => void;
		const result = new Promise<string>((resolveResult, rejectResult) => {
			resolve = resolveResult;
			reject = rejectResult;
		});
		const abort = vi.fn(() => reject(new Error('Yivi session aborted')));
		yiviSessions.push({ abort, resolve, reject, endOnFailure });
		return { session: { abort }, result };
	},
}));

const attrTypes: Record<string, AttrType> = {
	email: { id: 'email', handles: [], bannable: true, identifying: true, sources: [{ Yivi: { attr_type_id: 'yivi-email' } }] },
	phone: { id: 'phone', handles: [], bannable: true, identifying: false, sources: [{ Yivi: { attr_type_id: 'yivi-phone' } }] },
	ph_card: { id: 'ph_card', handles: [], bannable: false, identifying: true, sources: [{ Yivi: { attr_type_id: 'yivi-card' } }] },
};

const authsHandlers = [
	http.get('http://auths-test/.ph/welcome', () => HttpResponse.json({ Ok: { attr_types: attrTypes } }, { status: 200 })),
	http.post('http://auths-test/.ph/auth/start', () =>
		HttpResponse.json(
			{ Ok: { Success: { task: { Yivi: { disclosure_request: 'a-request', yivi_requestor_url: 'http://yivi-test/' } }, state: [1, 2, 3] } } },
			{ status: 200 },
		),
	),
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('Entering PubHubs', () => {
	let mss: ReturnType<typeof useMSS>;
	// Never dereferenced: the handler that would render into it is mocked away.
	const mountPoint = ref<HTMLElement | null>(null);

	beforeEach(() => {
		setActivePinia(createPinia());
		server.use(...authsHandlers);
		yiviSessions.length = 0;
		mss = useMSS();
	});

	// Resolves once the run in flight has got as far as showing its Yivi widget.
	const waitForYiviSession = (count: number) => vi.waitFor(() => expect(yiviSessions).toHaveLength(count));

	const enter = () => mss.enterPubHubs(loginMethods.Yivi, PHCEnterMode.LoginOrRegister, mountPoint);

	test('The widget being on screen is what a page can restart', async () => {
		const run = enter();
		await waitForYiviSession(1);

		expect(mss.awaitingDisclosure).toBe(true);

		mss.cancelEnter();
		await expect(run).rejects.toBeInstanceOf(EnterCancelled);
		expect(mss.awaitingDisclosure).toBe(false);
	});

	test('Cancelling stops the Yivi session it was showing', async () => {
		const run = enter();
		await waitForYiviSession(1);

		mss.cancelEnter();

		expect(yiviSessions[0].abort).toHaveBeenCalled();
		await expect(run).rejects.toBeInstanceOf(EnterCancelled);
	});

	test('A second attempt supersedes the first', async () => {
		// `AuthenticationServer` holds a single authentication state, so the run that was replaced has
		// to give up rather than complete an authentication against the state its replacement put there.
		const first = enter();
		await waitForYiviSession(1);

		const second = enter();
		await expect(first).rejects.toBeInstanceOf(EnterCancelled);
		expect(yiviSessions[0].abort).toHaveBeenCalled();

		mss.cancelEnter();
		await expect(second).rejects.toBeInstanceOf(EnterCancelled);
	});

	test('A superseded run renders no widget of its own', async () => {
		// Steps from the PubHubs enter onwards finish even once a run is superseded, and the last of
		// them issues the PubHubs card in a second Yivi session. That session must not draw over the
		// widget its replacement is showing, nor take the slot `cancelEnter()` reaches for. `-1` is a
		// run that has certainly been replaced, whatever the counter stands at.
		const run = enter();
		await waitForYiviSession(1);

		await expect(mss.runYiviSession('http://yivi-test', 'a-request', mountPoint, -1)).rejects.toBeInstanceOf(EnterCancelled);
		expect(yiviSessions).toHaveLength(1);

		mss.cancelEnter();
		await expect(run).rejects.toBeInstanceOf(EnterCancelled);
	});

	test('A session that fails on its own is reported, not thrown', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

		const run = enter();
		await waitForYiviSession(1);
		yiviSessions[0].reject(new Error('the Yivi server went away'));

		// Reported so the page can show it in place of the QR code, rather than sending the user to the
		// error page the way an unexpected throw would.
		await expect(run).resolves.toEqual({ key: 'errors.yivi_session_failed' });
		expect(mss.awaitingDisclosure).toBe(false);

		errorLog.mockRestore();
	});
});

describe('Giving up an entry that cannot be completed', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		// `PHCServer` reads the token when it is constructed, so anything left here reaches the next test.
		localStorage.clear();
	});

	// Everything up to the point where the account is entered, so the tests below can drive the steps
	// after it - the ones that leave the user holding an auth token they cannot use.
	const enterUpToTheUserSecret = async (mss: ReturnType<typeof useMSS>) => {
		const cardAttr = { signedAttr: 'jwt', id: 'ph_card', value: 'card-pseudonym' };
		const authServer = {
			welcomeEPAuths: async () => attrTypes,
			checkAttributes: () => new Set(['ph_card']),
			authStartEP: async () => ({ task: { Yivi: { disclosure_request: 'a-request', yivi_requestor_url: 'http://yivi-test/' } }, state: [1] }),
			setState: vi.fn(),
			getState: () => [1],
			completeAuthEP: async () => ({ attrs: { ph_card: 'jwt' } }),
		};
		vi.spyOn(mss, 'getAuthServer').mockResolvedValue(authServer as unknown as Awaited<ReturnType<typeof mss.getAuthServer>>);
		vi.spyOn(mss, 'validateAttributes').mockImplementation(() => {});
		vi.spyOn(mss, 'decodeSignedAttributes').mockReturnValue({ identifying: { ph_card: cardAttr }, additional: [], attributeValues: ['card'] });
		vi.spyOn(mss.phcServer, 'enter').mockResolvedValue({ entered: true, errorMessage: null, enterResp: [] });
		vi.spyOn(mss.phcServer, 'stateEP').mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof mss.phcServer.stateEP>>);

		const run = mss.enterPubHubs(loginMethods.Yivi, PHCEnterMode.Login, ref<HTMLElement | null>(null));
		await vi.waitFor(() => expect(yiviSessions).toHaveLength(1));
		yiviSessions[0].resolve('a-disclosure');
		return run;
	};

	test.each([
		[
			'the user secret cannot be resolved',
			(mss: ReturnType<typeof useMSS>) => vi.spyOn(mss, 'requestUserSecretObject').mockResolvedValue({ error: true, message: 'errors.general_error' }),
		],
		[
			'no attribute key is handed out',
			(mss: ReturnType<typeof useMSS>) => {
				vi.spyOn(mss, 'requestUserSecretObject').mockResolvedValue({ error: false, userSecret: null, userSecretBackup: null });
				vi.spyOn(mss, 'requestAttrKeys').mockResolvedValue({ error: true, response: 'errors.general_error' });
			},
		],
		[
			'the user secret cannot be stored',
			(mss: ReturnType<typeof useMSS>) => {
				vi.spyOn(mss, 'requestUserSecretObject').mockResolvedValue({ error: false, userSecret: null, userSecretBackup: null });
				vi.spyOn(mss, 'requestAttrKeys').mockResolvedValue({ error: false, response: {} });
				vi.spyOn(mss.phcServer, 'storeUserSecretObject').mockRejectedValue(new Error('the object store was unreachable'));
			},
		],
	])('an entry is given up the same way when %s', async (_name, breakIt) => {
		// An account that is entered but whose user secret is not usable must not leave the user half
		// logged in, and each of these used to clean up differently - one of them not resetting the
		// global store at all.
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const mss = useMSS();
		const abandon = vi.spyOn(mss, 'abandonEntry');
		yiviSessions.length = 0;
		server.use(...authsHandlers);
		breakIt(mss);

		await expect(await enterUpToTheUserSecret(mss)).toEqual({ key: 'errors.general_error' });
		expect(abandon).toHaveBeenCalledTimes(1);

		errorLog.mockRestore();
	});

	test('a replaced run leaves the entry its replacement made alone', async () => {
		// `abandonEntry` clears the auth token and the cached user secret process-wide, so a run that
		// has already been replaced must not call it: the login it would tear down is the one the user
		// is currently completing, and the router guard then bounces them straight back to the login
		// page. The failure is left to the run that still owns that state to report.
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const mss = useMSS();
		const abandon = vi.spyOn(mss, 'abandonEntry');
		yiviSessions.length = 0;
		server.use(...authsHandlers);

		// What a second login click does to a first one that has already disclosed: the new run takes
		// the entry over in the middle of step 10, then parks on a Yivi widget of its own - which is
		// the one the user is now looking at.
		let replacement!: ReturnType<typeof mss.enterPubHubs>;
		vi.spyOn(mss, 'requestUserSecretObject').mockImplementation(async () => {
			replacement = mss.enterPubHubs(loginMethods.Yivi, PHCEnterMode.Login, ref<HTMLElement | null>(null));
			return { error: true, message: 'errors.general_error' };
		});

		await expect(enterUpToTheUserSecret(mss)).rejects.toBeInstanceOf(EnterCancelled);
		expect(abandon).not.toHaveBeenCalled();

		mss.cancelEnter();
		await expect(replacement).rejects.toBeInstanceOf(EnterCancelled);
		errorLog.mockRestore();
	});

	test('a run cancelled with nothing taking over gives the entry up itself', async () => {
		// The page cancels the run without starting a replacement to make the card issuance report
		// `card_not_added` - a breakpoint swap or a page restored from the back/forward cache while the
		// issuance widget is up. Nobody is going to clean up on this run's behalf, so a step that fails
		// afterwards has to abandon the entry itself: leaving the auth token behind for an account whose
		// user secret was never stored is what makes an account that can never be logged in to again.
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const mss = useMSS();
		const abandon = vi.spyOn(mss, 'abandonEntry');
		yiviSessions.length = 0;
		server.use(...authsHandlers);

		vi.spyOn(mss, 'requestUserSecretObject').mockImplementation(async () => {
			mss.cancelEnter();
			return { error: true, message: 'errors.general_error' };
		});

		// Reported rather than thrown, so the page shows what happened and offers the retry.
		await expect(await enterUpToTheUserSecret(mss)).toEqual({ key: 'errors.general_error' });
		expect(abandon).toHaveBeenCalledTimes(1);

		errorLog.mockRestore();
	});

	test('the session is dropped without navigating away', async () => {
		// The page that started the entry shows what happened and decides where the user goes; a logout
		// that navigates by itself would race that and drop the query the login page was opened with.
		const mss = useMSS();
		const global = useGlobal();
		global.loggedIn = true;
		localStorage.setItem('PHauthToken', JSON.stringify({ auth_token: 'a-token', expires: Date.now() + 60_000 }));
		localStorage.setItem('UserSecret', 'a-secret');

		mss.abandonEntry();

		expect(global.loggedIn).toBe(false);
		expect(localStorage.getItem('PHauthToken')).toBeNull();
		expect(localStorage.getItem('UserSecret')).toBeNull();
	});

	test('the account state the store keeps in memory is dropped with it', async () => {
		// The store keeps its `PHCServer` across a logout, so whatever is left in memory goes on being
		// used - and clearing local storage does not reach it. `reset()` used to read the auth token
		// straight back out of local storage, and never cleared the cached user secret at all, so the
		// account that had just left would authorise the next request and have its own user secret
		// handed out instead of the logout procedure being triggered.
		localStorage.setItem('PHauthToken', JSON.stringify({ auth_token: 'a-token', expires: Math.floor(Date.now() / 1000) + 3600 }));
		localStorage.setItem('UserSecret', 'a-secret');
		// Read before the store is built: `PHCServer` picks the auth token up in its constructor.
		const mss = useMSS();
		const global = useGlobal();
		global.loggedIn = true;
		const logoutProcedure = vi.spyOn(mss.phcServer, 'triggerLogoutProcedure').mockImplementation(() => {});

		// Asking for them once is what caches them in memory.
		expect(await mss.phcServer['_getAuthToken']()).toBe('a-token');
		expect(await mss.phcServer.getUserSecretInfo()).toBe('a-secret');

		mss.abandonEntry();

		expect(await mss.phcServer['_getAuthToken']()).toBeUndefined();
		expect(await mss.phcServer.getUserSecretInfo()).toBeUndefined();
		expect(logoutProcedure).toHaveBeenCalled();
	});
});

describe('Issuing a PubHubs card after the account was entered', () => {
	let mss: ReturnType<typeof useMSS>;
	const mountPoint = ref<HTMLElement | null>(null);
	const cardAttr = { signedAttr: 'jwt', id: 'ph_card', value: 'card-pseudonym' };

	beforeEach(() => {
		setActivePinia(createPinia());
		mss = useMSS();
	});

	test('the card is stored in the user secret, not only handed to the Yivi app', async () => {
		// A card the next login discloses but the user secret has no entry for locks the account, so
		// issuing is only done once both have happened.
		vi.spyOn(mss, 'issueCard').mockResolvedValue({ cardAttr, errorMessage: null });
		const addCard = vi.spyOn(mss, 'addCardToUserSecret').mockResolvedValue(undefined);

		await expect(mss.issueCardAfterEntry('via email', mountPoint)).resolves.toEqual({ cardAttr, errorMessage: null });
		expect(addCard).toHaveBeenCalledWith(cardAttr);
	});

	test('a card that could not be stored is reported so the user can try again', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(mss, 'issueCard').mockResolvedValue({ cardAttr, errorMessage: null });
		vi.spyOn(mss, 'addCardToUserSecret').mockRejectedValue(new Error('the object store was unreachable'));

		await expect(mss.issueCardAfterEntry('via email', mountPoint)).resolves.toEqual({
			cardAttr: null,
			errorMessage: { key: 'errors.card_not_linked' },
		});

		errorLog.mockRestore();
	});

	test('a card that never reached the Yivi app is not stored either', async () => {
		vi.spyOn(mss, 'issueCard').mockResolvedValue({ cardAttr: null, errorMessage: { key: 'errors.card_not_added' } });
		const addCard = vi.spyOn(mss, 'addCardToUserSecret').mockResolvedValue(undefined);

		await expect(mss.issueCardAfterEntry('via email', mountPoint)).resolves.toEqual({
			cardAttr: null,
			errorMessage: { key: 'errors.card_not_added' },
		});
		expect(addCard).not.toHaveBeenCalled();
	});
});

describe('Issuing the PubHubs card in a chained Yivi session', () => {
	let mss: ReturnType<typeof useMSS>;
	// Success here only means the Yivi server has been handed the issuance request; whether it reaches
	// the user's app is up to the chained session, which is why the tests drive the two separately.
	let releaseNextSession: ReturnType<typeof vi.fn>;
	// The authentication server's long poll for the disclosure, which a test can leave outstanding.
	let waitForResult: () => Promise<unknown>;
	const mountPoint = ref<HTMLElement | null>(null);
	const emailAttr = { signedAttr: 'jwt', id: 'email', value: 'someone@example.com' };
	// The issuance decodes the signed card attribute, so it has to be a JWT that parses.
	const signedCardAttr = `header.${btoa(JSON.stringify({ attr_type: 'ph_card', value: 'card-pseudonym' }))}.signature`;

	beforeEach(() => {
		setActivePinia(createPinia());
		yiviSessions.length = 0;
		mss = useMSS();
		releaseNextSession = vi.fn(async () => ({}));
		waitForResult = async () => ({ Success: { disclosure: 'a-disclosure' } });
		// Chaining issues the card in the session the disclosure ran in, rather than a second one.
		vi.spyOn(useSettings(), 'isFeatureEnabled').mockReturnValue(true);
	});

	afterEach(() => {
		localStorage.clear();
	});

	// A registration that gets as far as releasing the issuance into the chained session. The widget is
	// left running: each test decides how that session ends.
	const enterChained = () => {
		const authServer = {
			welcomeEPAuths: async () => attrTypes,
			checkAttributes: () => new Set(['email']),
			authStartEP: async () => ({ task: { Yivi: { disclosure_request: 'a-request', yivi_requestor_url: 'http://yivi-test/' } }, state: [1] }),
			setState: vi.fn(),
			getState: () => [1],
			YiviWaitForResultEP: () => waitForResult(),
			completeAuthEP: async () => ({ attrs: { email: 'jwt' } }),
			CardEP: async () => ({ attr: signedCardAttr, issuance_request: 'an-issuance', yivi_requestor_url: 'http://yivi-test/' }),
			YiviReleaseNextSessionEP: releaseNextSession,
		};
		vi.spyOn(mss, 'getAuthServer').mockResolvedValue(authServer as unknown as Awaited<ReturnType<typeof mss.getAuthServer>>);
		vi.spyOn(mss, 'validateAttributes').mockImplementation(() => {});
		vi.spyOn(mss, 'decodeSignedAttributes').mockReturnValue({ identifying: { email: emailAttr }, additional: [], attributeValues: ['email'] });
		vi.spyOn(mss.phcServer, 'cardPseudoPackage').mockResolvedValue('a-package' as unknown as Awaited<ReturnType<typeof mss.phcServer.cardPseudoPackage>>);
		vi.spyOn(mss.phcServer, 'enter').mockResolvedValue({ entered: true, errorMessage: null, enterResp: [] });
		vi.spyOn(mss.phcServer, 'stateEP').mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof mss.phcServer.stateEP>>);
		vi.spyOn(mss, 'requestUserSecretObject').mockResolvedValue({ error: false, userSecret: null, userSecretBackup: null });
		vi.spyOn(mss, 'requestAttrKeys').mockResolvedValue({ error: false, response: {} });
		vi.spyOn(mss.phcServer, 'storeUserSecretObject').mockResolvedValue(undefined);

		return mss.enterPubHubs(loginMethods.Yivi, PHCEnterMode.LoginOrRegister, mountPoint);
	};

	// Resolves once the issuance has been handed to the Yivi server, which is the point from which the
	// chained session is the only thing that can still carry the card to the user.
	const waitForIssuanceReleased = () => vi.waitFor(() => expect(releaseNextSession).toHaveBeenCalled());

	test('the card is stored once the chained session has carried it to the app', async () => {
		const run = enterChained();
		await waitForIssuanceReleased();

		// The user approves the issuance in their Yivi app, which ends the chained session.
		yiviSessions[0].resolve('a-disclosure');

		await expect(run).resolves.toBeUndefined();
		expect(mss.requestUserSecretObject).toHaveBeenCalledWith(expect.objectContaining({ ph_card: expect.objectContaining({ id: 'ph_card' }) }));
	});

	test('the widget is not left to restart a chained session by itself', async () => {
		// Restarting sends the request the widget was given again, which is the disclosure - by the time
		// the card is being issued the authentication server has consumed it, so the restart yivi-web
		// offers on a cancelled session, and performs by itself when the window regains focus, starts a
		// session nobody is waiting for and shows the user a Yivi error.
		const run = enterChained();
		await waitForIssuanceReleased();

		expect(yiviSessions[0].endOnFailure).toBe(true);

		mss.cancelEnter();
		await expect(run).resolves.toEqual({ key: 'errors.card_not_added', values: ['via\nemail'] });
	});

	test('the page is told the card is being issued in the session that is already on screen', async () => {
		// What decides between telling the user to scan again and telling them to finish in the app they
		// already have open.
		const run = enterChained();
		await waitForIssuanceReleased();

		expect(mss.issuingCard).toBe(true);
		expect(mss.issuingCardInSameSession).toBe(true);

		yiviSessions[0].resolve('a-disclosure');
		await run;
		expect(mss.issuingCardInSameSession).toBe(false);
	});

	test('a chained session that ends before the disclosure arrives is reported, not waited on', async () => {
		// The authentication server holds its long poll open until the chained session expires, so a run
		// that only waits on that is left with nothing on screen and no way forward for ten minutes.
		waitForResult = () => new Promise(() => {});
		const run = enterChained();
		await vi.waitFor(() => expect(yiviSessions).toHaveLength(1));

		yiviSessions[0].reject(new Error('the user closed the Yivi app'));

		await expect(run).resolves.toEqual({ key: 'errors.yivi_session_failed' });
		expect(releaseNextSession).not.toHaveBeenCalled();
	});

	test('a chained session stopped before the card reached the app reports it instead of storing it', async () => {
		// What a breakpoint swap or a page restored from the back/forward cache does while the issuance
		// is up: the widget is gone, so the card never reaches the Yivi app. Releasing the next session
		// succeeded all the same, and the card attribute is on the account either way - so a run that
		// took that for success would store a card the user does not have, and the next login discloses
		// exactly that card.
		const run = enterChained();
		await waitForIssuanceReleased();

		mss.cancelEnter();

		await expect(run).resolves.toEqual({ key: 'errors.card_not_added', values: ['via\nemail'] });
		expect(mss.requestUserSecretObject).toHaveBeenCalledWith(expect.not.objectContaining({ ph_card: expect.anything() }));
	});
});
