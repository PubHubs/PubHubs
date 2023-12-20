import { createRouter, createWebHashHistory } from 'vue-router';
import { useUser, useRooms } from '@/store/store';
import { usePubHubs } from '@/core/pubhubsStore';
import { MatrixEvent } from 'matrix-js-sdk';
const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
	{ path: '/hub', name: 'hubpage', component: () => import('@/pages/HubPage.vue') },
	{ path: '/settings', name: 'settings', component: () => import('@/pages/Settings.vue') },
	{ path: '/admin', name: 'admin', component: () => import('@/pages/Admin.vue'), meta: { onlyAdmin: true } },
	{ path: '/room/:id', name: 'room', component: () => import('@/pages/Room.vue') },
	{ path: '/secureroom/:id', name: 'secure-room', component: () => import('@/pages/SecureRoomPage.vue') },
	{ path: '/roomerror/:id', name: 'error-page-room', component: () => import('@/pages/RoomErrorPage.vue') },
	{ path: '/nop', name: 'nop', component: () => import('@/pages/NotImplemented.vue') },
];

const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
});



router.beforeEach( (to) => {
	//Add a receipt marker when we change the room.
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	
    rooms.roomsArray.forEach(async (room) => {
        if (room.roomId === router.currentRoute.value.params.id) {
            const mEvent: MatrixEvent = rooms.getlastEvent(room.roomId);
            const sender = mEvent.event.sender!;
			await pubhubs.sendAcknowledgementReceipt(sender);
		}
    });	

	if (to.meta.onlyAdmin) {
		const { isAdmin } = useUser();
		if (isAdmin) {
			return true;
		}
		console.log('ONLY FOR ADMINS', isAdmin);
		return false;
	}
	return true;
});

export { routes, router };
