import { describe, expect, test } from 'vitest';

import { mergeGlobalSettings } from '@global-client/logic/utils/globalSettingsMerge';

import { type GlobalSettings } from '@global-client/stores/global';

import { Theme, TimeFormat } from '@hub-client/stores/settings';

const settings = (overrides: Partial<GlobalSettings> = {}): GlobalSettings => ({
	theme: Theme.System,
	timeformat: TimeFormat.format24,
	language: 'nl',
	hubs: [],
	...overrides,
});

const hub = (hubId: string, extra: Record<string, string> = {}) => ({ hubId, hubName: hubId.toUpperCase(), ...extra });

describe('mergeGlobalSettings', () => {
	test('keeps local scalar changes and takes remote ones otherwise', () => {
		const base = settings();
		const local = settings({ theme: Theme.Dark });
		const remote = settings({ language: 'en' });
		expect(mergeGlobalSettings(base, local, remote)).toMatchObject({ theme: Theme.Dark, language: 'en', timeformat: TimeFormat.format24 });
	});

	test('keeps hubs added on either side, local order first', () => {
		const base = settings({ hubs: [hub('a')] });
		const local = settings({ hubs: [hub('b'), hub('a')] });
		const remote = settings({ hubs: [hub('a'), hub('c')] });
		expect(mergeGlobalSettings(base, local, remote).hubs.map((h) => h.hubId)).toEqual(['b', 'a', 'c']);
	});

	test('drops hubs removed on either side', () => {
		const base = settings({ hubs: [hub('a'), hub('b'), hub('c')] });
		const local = settings({ hubs: [hub('a'), hub('c')] });
		const remote = settings({ hubs: [hub('b'), hub('c')] });
		expect(mergeGlobalSettings(base, local, remote).hubs.map((h) => h.hubId)).toEqual(['c']);
	});

	test('keeps a token entered locally and otherwise takes the remote token', () => {
		const base = settings({ hubs: [hub('a'), hub('b')] });
		const local = settings({ hubs: [hub('a', { accessToken: 'local-a', userId: '@u:a' }), hub('b')] });
		const remote = settings({ hubs: [hub('a', { accessToken: 'remote-a', userId: '@u:a' }), hub('b', { accessToken: 'remote-b', userId: '@u:b' })] });
		const merged = mergeGlobalSettings(base, local, remote).hubs;
		expect(merged[0].accessToken).toBe('local-a');
		expect(merged[1].accessToken).toBe('remote-b');
	});

	test('takes the remote hub name', () => {
		const base = settings({ hubs: [hub('a')] });
		const local = settings({ hubs: [{ hubId: 'a', hubName: 'Old' }] });
		const remote = settings({ hubs: [{ hubId: 'a', hubName: 'Renamed' }] });
		expect(mergeGlobalSettings(base, local, remote).hubs[0].hubName).toBe('Renamed');
	});

	test('without a base, local wins and remote-only hubs are kept', () => {
		const local = settings({ theme: Theme.Light, hubs: [hub('a')] });
		const remote = settings({ theme: Theme.Dark, hubs: [hub('b')] });
		const merged = mergeGlobalSettings(null, local, remote);
		expect(merged.theme).toBe(Theme.Light);
		expect(merged.hubs.map((h) => h.hubId)).toEqual(['a', 'b']);
	});

	test('does not share objects with its inputs', () => {
		const local = settings({ hubs: [hub('a')] });
		const merged = mergeGlobalSettings(settings(), local, settings());
		merged.hubs[0].hubName = 'changed';
		expect(local.hubs[0].hubName).toBe('A');
	});
});
