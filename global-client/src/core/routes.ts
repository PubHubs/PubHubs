import Hub from '@/pages/Hub.vue'

const routes = [
    { path: '/', name: 'home', component: () => import ('@/pages/Home.vue') },
    { path: '/hub/:id/:roomId?', name: 'hub', component: Hub },
];
export {routes};
