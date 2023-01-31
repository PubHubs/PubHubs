const routes = [
    { path: '/', name: 'home', component: () => import ('@/pages/Home.vue') },
    { path: '/login', name: 'login', component: () => import ('@/pages/Login.vue') },
    { path: '/logout', name: 'logout', component: () => import ('@/pages/Logout.vue') },
    { path: '/settings', name: 'settings', component: () => import ('@/pages/Settings.vue') },
    { path: '/room/:id', name: 'room', component: () => import ('@/pages/Room.vue') },
    { path: '/nop', name: 'nop', component: () => import ('@/pages/NotImplemented.vue') },
];
export {routes};
