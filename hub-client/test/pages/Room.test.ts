// Packages
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Logic
import { setUpi18n } from '@hub-client/i18n';
import { routes } from '@hub-client/logic/core/router';

// Pages
import Room from '@hub-client/pages/Room.vue';

describe('Room.vue Test', () => {
	test('room cannot be found redirects to error page', async () => {
		const router = createRouter({
			history: createWebHistory(),
			routes: routes,
		});
		let pushed = { name: 'not  yet', query: { errorKey: 'not set!' } };

		// Overrride router push method to test it.
		//@ts-ignore
		router.push = (p) => {
			pushed = p;
		};

		const i18n = setUpi18n();

		const wrapper = mount(Room, {
			global: {
				plugins: [createTestingPinia(), router, i18n],
			},
			props: {
				id: '!some_room:some.server',
			},
		});

		//Trigger seeing the computed property and taking the actions. Since it is a computed property
		const roomComputed = wrapper.vm.room;
		expect(roomComputed).toBeFalsy();
		expect(pushed.name).toEqual('error-page');
		expect(pushed.query.errorKey).toEqual('errors.cant_find_room');
	});
});
