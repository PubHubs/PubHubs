const routes = [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/hub', name: 'hubpage', component: () => import('@/pages/HubPage.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/pages/Settings.vue') },
    { path: '/room/:id', name: 'room', component: () => import('@/pages/Room.vue') },
    { path: '/secureroom/:id', name: 'secure-room', component: () => import('@/pages/SecureRoomPage.vue') },
    { path: '/roomerror/:id', name: 'error-page-room', component: () => import('@/pages/RoomErrorPage.vue') },
    { path: '/nop', name: 'nop', component: () => import('@/pages/NotImplemented.vue') },
];
export { routes };
