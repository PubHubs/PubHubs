import { describe, expect, test } from 'vitest';
// import { flushPromises, mount } from '@vue/test-utils';
// import { createTestingPinia } from '@pinia/testing';
// import { routes } from '@/logic/core/router.ts';
// import Room from '@/pages/Room.vue';
// import { createRouter, createWebHistory } from 'vue-router';

describe('Room.vue Test', () => {
	test('room cannot be found redirects to error page', async () => {
		// 		const router = createRouter({
		// 			history: createWebHistory(),
		// 			routes: routes,
		// 		});
		// 		let pushed = { name: 'not  yet', query: { errorKey: 'not set!' } };
		// 		// Overrride router push method to test it.
		// 		router.push = (p) => {
		// 			pushed = p;
		// 		};
		// 		const wrapper = mount(Room, {
		// 			global: {
		// 				plugins: [createTestingPinia(), router],
		// 			},
		// 			props: {
		// 				id: '!some_room:some.server',
		// 			},
		// 		});
		// 		//Trigger seeing the computed property and taking the actions. Since it is a computed property
		// 		let roomProp = wrapper.vm.room;
		// 		expect(roomProp).toBeFalsy();
		// 		expect(pushed.name).toEqual('error-page');
		// 		expect(pushed.query.errorKey).toEqual('errors.cant_find_room');
	});
});
