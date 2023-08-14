import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, assert, expect, test } from 'vitest';
import { useSettings } from '@/store/settings';

describe('Settings Store', () => {
    let settings = {} as any;

    beforeEach(() => {
        setActivePinia(createPinia());
        settings = useSettings();
        settings.pagination = 10;
        settings.visibleEventTypes = ['m.room.message'];
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
                availableLocales: ['en', 'nl']
            }

            expect(settings.language).toBe('en');
            expect(settings.getActiveLanguage).toBe('en');

            settings.setLanguage('nl');
            expect(settings.language).toBe('nl');
            expect(settings.getActiveLanguage).toBe('nl');
        });
    });


    describe('themes', () => {
        test('getThemeOptions', () => {
            expect(settings.getThemeOptions()).toBeTypeOf('object');
            expect(settings.getThemeOptions()).toHaveLength(3);
            expect(settings.getThemeOptions()[0].label).toBeTypeOf('string');
            expect(settings.getThemeOptions()[0].value).toBeTypeOf('string');
            expect(settings.getThemeOptions()[0]).toEqual({ label: 'System', value: 'system' });
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
            expect(settings.getThemeOptions(themes)[0]).toEqual({ label: 'Systeem', value: 'system' });
        });
    });
});
