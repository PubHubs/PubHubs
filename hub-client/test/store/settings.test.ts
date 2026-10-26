// Packages
import { EventType } from 'matrix-js-sdk';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import { useSettings } from '@hub-client/stores/settings';

describe('Settings Store', () => {
	let settings = {} as any;

	beforeEach(() => {
		setActivePinia(createPinia());
		settings = useSettings();
		settings.pagination = 10;
		settings.visibleEventTypes = [EventType.RoomMessage];
	});

	describe('pagination', () => {
		test('default', () => {
			expect(settings.pagination).toBe(10);
		});

		test('getPagination', () => {
			expect(settings.getPagination).toBe(10);
		});

		test('setPagination', () => {
			settings.setPagination(20);
			expect(settings.getPagination).toBe(20);
		});
	});

	describe('language', () => {
		test('default', () => {
			settings._i18n = {
				availableLocales: ['en', 'nl'],
			};

			expect(settings.language).toBe('nl');
			expect(settings.getActiveLanguage).toBe('nl');

			settings.setLanguage('en');
			expect(settings.language).toBe('en');
			expect(settings.getActiveLanguage).toBe('en');
		});
	});

	describe('themes', () => {
		test('getThemeOptions', () => {
			expect(settings.getThemeOptions()).toBeTypeOf('object');
			expect(settings.getThemeOptions()).toHaveLength(3);
			expect(settings.getThemeOptions()[0].label).toBeTypeOf('string');
			expect(settings.getThemeOptions()[0].value).toBeTypeOf('string');
			expect(settings.getThemeOptions()[0]).toEqual({
				label: 'System',
				value: 'system',
			});
		});

		test('getThemeOptions localization', () => {
			const themes = (theme: string) => {
				const t = {
					'themes.system': 'Systeem',
					'themes.light': 'Licht',
					'themes.dark': 'Donker',
				};
				return t[theme];
			};
			expect(settings.getThemeOptions(themes)).toBeTypeOf('object');
			expect(settings.getThemeOptions(themes)).toHaveLength(3);
			expect(settings.getThemeOptions(themes)[0].label).toBeTypeOf('string');
			expect(settings.getThemeOptions(themes)[0].value).toBeTypeOf('string');
			expect(settings.getThemeOptions(themes)[0]).toEqual({
				label: 'Systeem',
				value: 'system',
			});
		});

		test('getActiveTheme follows the system theme when it changes', async () => {
			// A media query list whose answer can be switched, as the system does when its theme changes.
			const darkQuery = Object.assign(new EventTarget(), { matches: false });
			vi.stubGlobal('matchMedia', () => darkQuery);
			// The store reads the media query when it is loaded, so load it again with the one above.
			vi.resetModules();
			const freshPinia = await import('pinia');
			freshPinia.setActivePinia(freshPinia.createPinia());
			const { useSettings: useFreshSettings, Theme } = await import('@hub-client/stores/settings');
			const freshSettings = useFreshSettings();
			freshSettings.setTheme(Theme.System);

			expect(freshSettings.getActiveTheme).toBe(Theme.Light);
			darkQuery.matches = true;
			darkQuery.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
			expect(freshSettings.getActiveTheme).toBe(Theme.Dark);

			vi.unstubAllGlobals();
		});
	});
});
