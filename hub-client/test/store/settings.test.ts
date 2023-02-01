import { setActivePinia, createPinia } from 'pinia'
import { describe, beforeEach, assert, expect, test } from 'vitest'
import { useSettings } from '@/store/settings'

describe('Settings Store', () => {

    let settings = {} as any;

    beforeEach(() => {
        setActivePinia(createPinia())
        settings = useSettings();
        settings.pagination = 10;
        settings.visibleEventTypes = ['m.room.message'];
    })

    describe('pagination', () => {
        test('default', () => {
            expect(settings.pagination).toBe(10);
        })

        test('getPagination', () => {
            expect(settings.getPagination).toBe(10);
        })

        test('setPagination', () => {
            settings.setPagination(20);
            expect(settings.getPagination).toBe(20);
        })
    })

    describe('visibleEventTypes', () => {
        test('default', () => {
            expect(settings.getVisibleEventTypes).toHaveLength(1);
            expect(settings.getVisibleEventTypes).toEqual(['m.room.message']);
        })

        test('getVisibleEventTypes', () => {
            settings.visibleEventTypes = ['one', 'two'];
            expect(settings.getVisibleEventTypes).toHaveLength(2);
            expect(settings.getVisibleEventTypes).toEqual(['one', 'two']);
        })

    })

    describe('themes', () => {
        test('getThemeOptions', () => {
            expect(settings.getThemeOptions()).toBeTypeOf('object');
            expect(settings.getThemeOptions()).toHaveLength(3);
            expect(settings.getThemeOptions()[0].label).toBeTypeOf('string');
            expect(settings.getThemeOptions()[0].value).toBeTypeOf('string');
            expect(settings.getThemeOptions()[0]).toEqual({label:'System',value:'system'});
        })

        test('getThemeOptions localization', () => {
            const themes = (theme:string) => {
                const t = {
                    "themes.system" : "Systeem",
                    "themes.light" : "Licht",
                    "themes.dark" : "Donker"
                };
                return t[theme];
            }
            expect(settings.getThemeOptions(themes)).toBeTypeOf('object');
            expect(settings.getThemeOptions(themes)).toHaveLength(3);
            expect(settings.getThemeOptions(themes)[0].label).toBeTypeOf('string');
            expect(settings.getThemeOptions(themes)[0].value).toBeTypeOf('string');
            expect(settings.getThemeOptions(themes)[0]).toEqual({label:'Systeem',value:'system'});
        })


    })

})
