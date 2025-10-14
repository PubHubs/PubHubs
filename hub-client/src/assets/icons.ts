/**
 * Icons are taken from: https://phosphoricons.com/?weight=fill&q=house&size=16
 *
 * If you add a new one:
 * - Use same name.
 * - Select the style (mostly fill) and Export the SVG raw for copy/paste here.
 * - Allwats include the default variant, mostly this will be the same as the fill. But not allways! Ask UX-designer which one.
 * - Please keep in alphabetical order, for easy reference.
 *
 * sizes:
 * - base 16px
 * - lg 24px
 */

import { PHiconSizes, iconSizes } from './sizes.js';

const phicons: { [key: string]: { [key: string]: string } } = {
	'arrow-bend-up-left': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H88v40a8,8,0,0,1-13.66,5.66l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,88,56V96h40A104.11,104.11,0,0,1,232,200Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H88v40a8,8,0,0,1-13.66,5.66l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,88,56V96h40A104.11,104.11,0,0,1,232,200Z"/></svg>`,
	},
	'arrow-circle-up': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,128A104,104,0,1,0,128,232,104.11,104.11,0,0,0,232,128Zm-66.34-2.34a8,8,0,0,1-11.32,0L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0l32,32A8,8,0,0,1,165.66,125.66Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,128A104,104,0,1,0,128,232,104.11,104.11,0,0,0,232,128Zm-66.34-2.34a8,8,0,0,1-11.32,0L136,107.31V168a8,8,0,0,1-16,0V107.31l-18.34,18.35a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0l32,32A8,8,0,0,1,165.66,125.66Z"/></svg>`,
	},
	'arrow-counter-clockwise': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M88,104H40a8,8,0,0,1-8-8V48a8,8,0,0,1,13.66-5.66L64,60.7a95.42,95.42,0,0,1,66-26.76h.53a95.36,95.36,0,0,1,67.07,27.33,8,8,0,0,1-11.18,11.44,79.52,79.52,0,0,0-55.89-22.77h-.45A79.48,79.48,0,0,0,75.35,72L93.66,90.34A8,8,0,0,1,88,104Zm128,48H168a8,8,0,0,0-5.66,13.66L180.65,184a79.48,79.48,0,0,1-54.72,22.09h-.45a79.52,79.52,0,0,1-55.89-22.77,8,8,0,1,0-11.18,11.44,95.36,95.36,0,0,0,67.07,27.33H126a95.42,95.42,0,0,0,66-26.76l18.36,18.36A8,8,0,0,0,224,208V160A8,8,0,0,0,216,152Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M88,104H40a8,8,0,0,1-8-8V48a8,8,0,0,1,13.66-5.66L64,60.7a95.42,95.42,0,0,1,66-26.76h.53a95.36,95.36,0,0,1,67.07,27.33,8,8,0,0,1-11.18,11.44,79.52,79.52,0,0,0-55.89-22.77h-.45A79.48,79.48,0,0,0,75.35,72L93.66,90.34A8,8,0,0,1,88,104Zm128,48H168a8,8,0,0,0-5.66,13.66L180.65,184a79.48,79.48,0,0,1-54.72,22.09h-.45a79.52,79.52,0,0,1-55.89-22.77,8,8,0,1,0-11.18,11.44,95.36,95.36,0,0,0,67.07,27.33H126a95.42,95.42,0,0,0,66-26.76l18.36,18.36A8,8,0,0,0,224,208V160A8,8,0,0,0,216,152Z"/></svg>`,
	},
	'arrow-left': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="216" y1="128" x2="40" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><polyline points="112 56 40 128 112 200" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="216" y1="128" x2="40" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><polyline points="112 56 40 128 112 200" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,128a8,8,0,0,1-8,8H120v64a8,8,0,0,1-13.66,5.66l-72-72a8,8,0,0,1,0-11.32l72-72A8,8,0,0,1,120,56v64h96A8,8,0,0,1,224,128Z"/></svg>`,
	},
	'arrow-right': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><polyline points="144 56 216 128 144 200" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><polyline points="144 56 216 128 144 200" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.66,133.66l-72,72A8,8,0,0,1,136,200V136H40a8,8,0,0,1,0-16h96V56a8,8,0,0,1,13.66-5.66l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>`,
	},
	'arrows-clockwise': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1-5.66-13.66L180.65,72a79.48,79.48,0,0,0-54.72-22.09h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27,96,96,0,0,1,192,60.7l18.36-18.36A8,8,0,0,1,224,48ZM186.41,183.29A80,80,0,0,1,75.35,184l18.31-18.31A8,8,0,0,0,88,152H40a8,8,0,0,0-8,8v48a8,8,0,0,0,13.66,5.66L64,195.3a95.42,95.42,0,0,0,66,26.76h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1-5.66-13.66L180.65,72a79.48,79.48,0,0,0-54.72-22.09h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27,96,96,0,0,1,192,60.7l18.36-18.36A8,8,0,0,1,224,48ZM186.41,183.29A80,80,0,0,1,75.35,184l18.31-18.31A8,8,0,0,0,88,152H40a8,8,0,0,0-8,8v48a8,8,0,0,0,13.66,5.66L64,195.3a95.42,95.42,0,0,0,66,26.76h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>`,
	},
	at: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M184,208c-15.21,10.11-36.37,16-56,16a96,96,0,1,1,96-96c0,22.09-8,40-28,40s-28-17.91-28-40V88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M184,208c-15.21,10.11-36.37,16-56,16a96,96,0,1,1,96-96c0,22.09-8,40-28,40s-28-17.91-28-40V88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,128c0,.51,0,1,0,1.52-.34,14.26-5.63,30.48-28,30.48-23.14,0-28-17.4-28-32V88a8,8,0,0,0-8.53-8A8.17,8.17,0,0,0,160,88.27v4a48,48,0,1,0,6.73,64.05,40.19,40.19,0,0,0,3.38,5C175.48,168,185.71,176,204,176a54.81,54.81,0,0,0,9.22-.75,4,4,0,0,1,4.09,6A104.05,104.05,0,0,1,125.91,232C71.13,230.9,26.2,186.86,24.08,132.11A104,104,0,1,1,232,128ZM96,128a32,32,0,1,0,32-32A32,32,0,0,0,96,128Z"/></svg>`,
	},
	basketball: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M63.6,46.39a103.48,103.48,0,0,1,52-21.65,4,4,0,0,1,4.45,4V120H95.7A103.77,103.77,0,0,0,63.38,52.44,4,4,0,0,1,63.6,46.39ZM46,64.07a103.51,103.51,0,0,0-21.29,51.46,4,4,0,0,0,4,4.47H79.63A87.86,87.86,0,0,0,51.89,63.59,4,4,0,0,0,46,64.07ZM192.4,46.39a103.48,103.48,0,0,0-52-21.65,4,4,0,0,0-4.45,4V120h24.3a103.77,103.77,0,0,1,32.32-67.56A4,4,0,0,0,192.4,46.39Zm38.86,69.14A103.51,103.51,0,0,0,210,64.07a4,4,0,0,0-5.86-.48A87.86,87.86,0,0,0,176.37,120h50.91A4,4,0,0,0,231.26,115.53ZM24.74,140.47A103.51,103.51,0,0,0,46,191.93a4,4,0,0,0,5.86.48A87.86,87.86,0,0,0,79.63,136H28.72A4,4,0,0,0,24.74,140.47ZM210,191.93a103.51,103.51,0,0,0,21.29-51.46,4,4,0,0,0-4-4.47H176.37a87.86,87.86,0,0,0,27.74,56.41A4,4,0,0,0,210,191.93ZM63.6,209.61a103.48,103.48,0,0,0,52,21.65,4,4,0,0,0,4.45-4V136H95.7a103.77,103.77,0,0,1-32.32,67.56A4,4,0,0,0,63.6,209.61ZM160.3,136H136v91.28a4,4,0,0,0,4.45,4,103.48,103.48,0,0,0,52-21.65,4,4,0,0,0,.22-6.05A103.77,103.77,0,0,1,160.3,136Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M63.6,46.39a103.48,103.48,0,0,1,52-21.65,4,4,0,0,1,4.45,4V120H95.7A103.77,103.77,0,0,0,63.38,52.44,4,4,0,0,1,63.6,46.39ZM46,64.07a103.51,103.51,0,0,0-21.29,51.46,4,4,0,0,0,4,4.47H79.63A87.86,87.86,0,0,0,51.89,63.59,4,4,0,0,0,46,64.07ZM192.4,46.39a103.48,103.48,0,0,0-52-21.65,4,4,0,0,0-4.45,4V120h24.3a103.77,103.77,0,0,1,32.32-67.56A4,4,0,0,0,192.4,46.39Zm38.86,69.14A103.51,103.51,0,0,0,210,64.07a4,4,0,0,0-5.86-.48A87.86,87.86,0,0,0,176.37,120h50.91A4,4,0,0,0,231.26,115.53ZM24.74,140.47A103.51,103.51,0,0,0,46,191.93a4,4,0,0,0,5.86.48A87.86,87.86,0,0,0,79.63,136H28.72A4,4,0,0,0,24.74,140.47ZM210,191.93a103.51,103.51,0,0,0,21.29-51.46,4,4,0,0,0-4-4.47H176.37a87.86,87.86,0,0,0,27.74,56.41A4,4,0,0,0,210,191.93ZM63.6,209.61a103.48,103.48,0,0,0,52,21.65,4,4,0,0,0,4.45-4V136H95.7a103.77,103.77,0,0,1-32.32,67.56A4,4,0,0,0,63.6,209.61ZM160.3,136H136v91.28a4,4,0,0,0,4.45,4,103.48,103.48,0,0,0,52-21.65,4,4,0,0,0,.22-6.05A103.77,103.77,0,0,1,160.3,136Z"/></svg>`,
	},
	bell: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"/></svg>`,
	},
	calendar: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM112,184a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm56-8a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136a23.76,23.76,0,0,1-4.84,14.45L152,176ZM48,80V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM112,184a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm56-8a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136a23.76,23.76,0,0,1-4.84,14.45L152,176ZM48,80V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80Z"/></svg>`,
	},
	'caret-down': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94Z"/></svg>`,
	},
	'caret-left': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="160 208 80 128 160 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="160 208 80 128 160 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M163.06,40.61a8,8,0,0,0-8.72,1.73l-80,80a8,8,0,0,0,0,11.32l80,80A8,8,0,0,0,168,208V48A8,8,0,0,0,163.06,40.61Z"/></svg>`,
	},
	'caret-right': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34Z"/></svg>`,
	},
	'caret-up': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="48 160 128 80 208 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="48 160 128 80 208 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34Z"/></svg>`,
	},
	'chart-bar': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"/></svg>`,
	},
	'chat-circle': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z"/></svg>`,
	},
	'chat-circle-text': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z"/></svg>`,
	},
	'chats-circle': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232.07,186.76a80,80,0,0,0-62.5-114.17A80,80,0,1,0,23.93,138.76l-7.27,24.71a16,16,0,0,0,19.87,19.87l24.71-7.27a80.39,80.39,0,0,0,25.18,7.35,80,80,0,0,0,108.34,40.65l24.71,7.27a16,16,0,0,0,19.87-19.86Zm-16.25,1.47L224,216l-27.76-8.17a8,8,0,0,0-6,.63,64.05,64.05,0,0,1-85.87-24.88A79.93,79.93,0,0,0,174.7,89.71a64,64,0,0,1,41.75,92.48A8,8,0,0,0,215.82,188.23Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232.07,186.76a80,80,0,0,0-62.5-114.17A80,80,0,1,0,23.93,138.76l-7.27,24.71a16,16,0,0,0,19.87,19.87l24.71-7.27a80.39,80.39,0,0,0,25.18,7.35,80,80,0,0,0,108.34,40.65l24.71,7.27a16,16,0,0,0,19.87-19.86Zm-16.25,1.47L224,216l-27.76-8.17a8,8,0,0,0-6,.63,64.05,64.05,0,0,1-85.87-24.88A79.93,79.93,0,0,0,174.7,89.71a64,64,0,0,1,41.75,92.48A8,8,0,0,0,215.82,188.23Z"/></svg>`,
	},
	'check-circle': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>`,
	},
	circle: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="104"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="104"/></svg>`,
	},
	clock: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm56,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm56,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"/></svg>`,
	},
	compass: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm51.58,57.79-32,64a4.08,4.08,0,0,1-1.79,1.79l-64,32a4,4,0,0,1-5.37-5.37l32-64a4.08,4.08,0,0,1,1.79-1.79l64-32A4,4,0,0,1,179.58,81.79Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm51.58,57.79-32,64a4.08,4.08,0,0,1-1.79,1.79l-64,32a4,4,0,0,1-5.37-5.37l32-64a4.08,4.08,0,0,1,1.79-1.79l64-32A4,4,0,0,1,179.58,81.79Z"/></svg>`,
	},
	dog: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M239.71,125l-16.42-88a16,16,0,0,0-19.61-12.58l-.31.09L150.85,40h-45.7L52.63,24.56l-.31-.09A16,16,0,0,0,32.71,37.05L16.29,125a15.77,15.77,0,0,0,9.12,17.52A16.26,16.26,0,0,0,32.12,144,15.48,15.48,0,0,0,40,141.84V184a40,40,0,0,0,40,40h96a40,40,0,0,0,40-40V141.85a15.5,15.5,0,0,0,7.87,2.16,16.31,16.31,0,0,0,6.72-1.47A15.77,15.77,0,0,0,239.71,125ZM176,208H136V195.31l13.66-13.65a8,8,0,0,0-11.32-11.32L128,180.69l-10.34-10.35a8,8,0,0,0-11.32,11.32L120,195.31V208H80a24,24,0,0,1-24-24V123.11L107.93,56h40.14L200,123.11V184A24,24,0,0,1,176,208Zm-72-68a12,12,0,1,1-12-12A12,12,0,0,1,104,140Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,140Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M239.71,125l-16.42-88a16,16,0,0,0-19.61-12.58l-.31.09L150.85,40h-45.7L52.63,24.56l-.31-.09A16,16,0,0,0,32.71,37.05L16.29,125a15.77,15.77,0,0,0,9.12,17.52A16.26,16.26,0,0,0,32.12,144,15.48,15.48,0,0,0,40,141.84V184a40,40,0,0,0,40,40h96a40,40,0,0,0,40-40V141.85a15.5,15.5,0,0,0,7.87,2.16,16.31,16.31,0,0,0,6.72-1.47A15.77,15.77,0,0,0,239.71,125ZM176,208H136V195.31l13.66-13.65a8,8,0,0,0-11.32-11.32L128,180.69l-10.34-10.35a8,8,0,0,0-11.32,11.32L120,195.31V208H80a24,24,0,0,1-24-24V123.11L107.93,56h40.14L200,123.11V184A24,24,0,0,1,176,208Zm-72-68a12,12,0,1,1-12-12A12,12,0,0,1,104,140Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,140Z"/></svg>`,
	},
	'dots-three': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="12"/><circle cx="196" cy="128" r="12"/><circle cx="60" cy="128" r="12"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="12"/><circle cx="196" cy="128" r="12"/><circle cx="60" cy="128" r="12"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V96A16,16,0,0,0,224,80ZM60,140a12,12,0,1,1,12-12A12,12,0,0,1,60,140Zm68,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm68,0a12,12,0,1,1,12-12A12,12,0,0,1,196,140Z"/></svg>`,
	},
	'dots-three-vertical': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="12"/><circle cx="128" cy="60" r="12"/><circle cx="128" cy="196" r="12"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="12"/><circle cx="128" cy="60" r="12"/><circle cx="128" cy="196" r="12"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M160,16H96A16,16,0,0,0,80,32V224a16,16,0,0,0,16,16h64a16,16,0,0,0,16-16V32A16,16,0,0,0,160,16ZM128,208a12,12,0,1,1,12-12A12,12,0,0,1,128,208Zm0-68a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm0-68a12,12,0,1,1,12-12A12,12,0,0,1,128,72Z"/></svg>`,
	},
	'download-simple': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,168,96H136V32a8,8,0,0,0-16,0V96H88a8,8,0,0,0-5.66,13.66Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,168,96H136V32a8,8,0,0,0-16,0V96H88a8,8,0,0,0-5.66,13.66Z"/></svg>`,
	},
	envelope: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"/></svg>`,
	},
	flag: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,56V176a8,8,0,0,1-2.76,6c-15.28,13.23-29.89,18-43.82,18-18.91,0-36.57-8.74-53-16.85C105.87,170,82.79,158.61,56,179.77V224a8,8,0,0,1-16,0V56a8,8,0,0,1,2.77-6h0c36-31.18,68.31-15.21,96.79-1.12C167,62.46,190.79,74.2,218.76,50A8,8,0,0,1,232,56Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,56V176a8,8,0,0,1-2.76,6c-15.28,13.23-29.89,18-43.82,18-18.91,0-36.57-8.74-53-16.85C105.87,170,82.79,158.61,56,179.77V224a8,8,0,0,1-16,0V56a8,8,0,0,1,2.77-6h0c36-31.18,68.31-15.21,96.79-1.12C167,62.46,190.79,74.2,218.76,50A8,8,0,0,1,232,56Z"/></svg>`,
	},
	globe: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M168,128c0,64-40,96-40,96s-40-32-40-96,40-96,40-96S168,64,168,128Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="37.46" y1="96" x2="218.54" y2="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="37.46" y1="160" x2="218.54" y2="160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M168,128c0,64-40,96-40,96s-40-32-40-96,40-96,40-96S168,64,168,128Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="37.46" y1="96" x2="218.54" y2="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="37.46" y1="160" x2="218.54" y2="160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm78.36,64H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM216,128a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM128,43a115.27,115.27,0,0,1,26,45H102A115.11,115.11,0,0,1,128,43ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48Zm50.35,61.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></svg>`,
	},
	headset: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm78.36,64H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM216,128a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM128,43a115.27,115.27,0,0,1,26,45H102A115.11,115.11,0,0,1,128,43ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48Zm50.35,61.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm78.36,64H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM216,128a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM128,43a115.27,115.27,0,0,1,26,45H102A115.11,115.11,0,0,1,128,43ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48Zm50.35,61.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></svg>`,
	},
	house: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"/></svg>`,
	},
	'image-square': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM48,48H208v77.38l-24.69-24.7a16,16,0,0,0-22.62,0L53.37,208H48ZM80,96a16,16,0,1,1,16,16A16,16,0,0,1,80,96Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM48,48H208v77.38l-24.69-24.7a16,16,0,0,0-22.62,0L53.37,208H48ZM80,96a16,16,0,1,1,16,16A16,16,0,0,1,80,96Z"/></svg>`,
	},
	info: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z"/></svg>`,
	},
	'folder-simple': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,88V200.89A15.13,15.13,0,0,1,216.89,216H40a16,16,0,0,1-16-16V64A16,16,0,0,1,40,48H93.33a16.12,16.12,0,0,1,9.6,3.2L130.67,72H216A16,16,0,0,1,232,88Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M232,88V200.89A15.13,15.13,0,0,1,216.89,216H40a16,16,0,0,1-16-16V64A16,16,0,0,1,40,48H93.33a16.12,16.12,0,0,1,9.6,3.2L130.67,72H216A16,16,0,0,1,232,88Z"/></svg>`,
	},
	key: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM180,92a16,16,0,1,1,16-16A16,16,0,0,1,180,92Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM180,92a16,16,0,1,1,16-16A16,16,0,0,1,180,92Z"/></svg>`,
	},
	lightbulb: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-32.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-32.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"/></svg>`,
	},
	'lightning-slash': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M105.72,67.81a4,4,0,0,1,0-5.42l48.39-51.85a8,8,0,0,1,13.7,7L153.18,90.9l57.43,21.53a8.24,8.24,0,0,1,4.22,3.4,8,8,0,0,1-1,9.63l-25.27,27.07a4,4,0,0,1-5.88,0Zm27.76,54.32L53.92,34.62A8,8,0,1,0,42.08,45.38L81.34,88.56l-39,41.83A8.15,8.15,0,0,0,40,135.31a8,8,0,0,0,5.16,8.18l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l61.86-66.28,38.37,42.2a8,8,0,1,0,11.84-10.76Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M105.72,67.81a4,4,0,0,1,0-5.42l48.39-51.85a8,8,0,0,1,13.7,7L153.18,90.9l57.43,21.53a8.24,8.24,0,0,1,4.22,3.4,8,8,0,0,1-1,9.63l-25.27,27.07a4,4,0,0,1-5.88,0Zm27.76,54.32L53.92,34.62A8,8,0,1,0,42.08,45.38L81.34,88.56l-39,41.83A8.15,8.15,0,0,0,40,135.31a8,8,0,0,0,5.16,8.18l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l61.86-66.28,38.37,42.2a8,8,0,1,0,11.84-10.76Z"/></svg>`,
	},
	lock: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Zm32-84H96V56a32,32,0,0,1,64,0Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Zm32-84H96V56a32,32,0,0,1,64,0Z"/></svg>`,
	},
	'lock-open': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Z"/></svg>`,
	},
	'magnifying-glass': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="112" cy="112" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="168.57" y1="168.57" x2="224" y2="224" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="112" cy="112" r="80" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="168.57" y1="168.57" x2="224" y2="224" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/></svg>`,
	},
	'map-pin': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>`,
	},
	'megaphone-simple': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M228.54,86.66l-176.06-54A16,16,0,0,0,32,48V192a16,16,0,0,0,16,16,16,16,0,0,0,4.52-.65L136,181.73V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16v-29.9l28.54-8.75A16.09,16.09,0,0,0,240,138V102A16.09,16.09,0,0,0,228.54,86.66ZM184,192H152V176.82L184,167Zm40-54-.11,0L152,160.08V79.91L223.89,102l.11,0v36Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M228.54,86.66l-176.06-54A16,16,0,0,0,32,48V192a16,16,0,0,0,16,16,16,16,0,0,0,4.52-.65L136,181.73V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16v-29.9l28.54-8.75A16.09,16.09,0,0,0,240,138V102A16.09,16.09,0,0,0,228.54,86.66ZM184,192H152V176.82L184,167Zm40-54-.11,0L152,160.08V79.91L223.89,102l.11,0v36Z"/></svg>`,
	},
	'paper-plane-right': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M240,127.89a16,16,0,0,1-8.18,14L63.9,237.9A16.15,16.15,0,0,1,56,240a16,16,0,0,1-15-21.33l27-79.95A4,4,0,0,1,71.72,136H144a8,8,0,0,0,8-8.53,8.19,8.19,0,0,0-8.26-7.47h-72a4,4,0,0,1-3.79-2.72l-27-79.94A16,16,0,0,1,63.84,18.07l168,95.89A16,16,0,0,1,240,127.89Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M240,127.89a16,16,0,0,1-8.18,14L63.9,237.9A16.15,16.15,0,0,1,56,240a16,16,0,0,1-15-21.33l27-79.95A4,4,0,0,1,71.72,136H144a8,8,0,0,0,8-8.53,8.19,8.19,0,0,0-8.26-7.47h-72a4,4,0,0,1-3.79-2.72l-27-79.94A16,16,0,0,1,63.84,18.07l168,95.89A16,16,0,0,1,240,127.89Z"/></svg>`,
	},
	'pen-nib': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M243.31,81.36,174.63,12.68a16,16,0,0,0-22.63,0L123.56,41.12l-58,21.76A16,16,0,0,0,55.36,75.23L34.59,199.83a4,4,0,0,0,6.77,3.49l57-57a23.85,23.85,0,0,1-2.29-12.08,24,24,0,1,1,13.6,23.4l-57,57a4,4,0,0,0,3.49,6.77l124.61-20.77a16,16,0,0,0,12.35-10.16l21.77-58.07L243.31,104a16,16,0,0,0,0-22.63ZM208,116.68,139.32,48l24-24L232,92.68Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M243.31,81.36,174.63,12.68a16,16,0,0,0-22.63,0L123.56,41.12l-58,21.76A16,16,0,0,0,55.36,75.23L34.59,199.83a4,4,0,0,0,6.77,3.49l57-57a23.85,23.85,0,0,1-2.29-12.08,24,24,0,1,1,13.6,23.4l-57,57a4,4,0,0,0,3.49,6.77l124.61-20.77a16,16,0,0,0,12.35-10.16l21.77-58.07L243.31,104a16,16,0,0,0,0-22.63ZM208,116.68,139.32,48l24-24L232,92.68Z"/></svg>`,
	},
	'pencil-simple': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM192,108.68,147.31,64l24-24L216,84.68Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM192,108.68,147.31,64l24-24L216,84.68Z"/></svg>`,
	},
	plus: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="128" y1="40" x2="128" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="128" y1="40" x2="128" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"/></svg>`,
	},
	'plus-circle': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24Zm40,112H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24Zm40,112H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"/></svg>`,
	},
	'plus-square': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"/></svg>`,
	},
	prohibit: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="195.88" y1="195.88" x2="60.12" y2="60.12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="195.88" y1="195.88" x2="60.12" y2="60.12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M200,128a71.69,71.69,0,0,1-15.78,44.91L83.09,71.78A71.95,71.95,0,0,1,200,128ZM56,128a71.95,71.95,0,0,0,116.91,56.22L71.78,83.09A71.69,71.69,0,0,0,56,128Zm180,0A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-20,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/></svg>`,
	},
	question: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,125.38,154.24,139.93,136,143.28Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,125.38,154.24,139.93,136,143.28Z"/></svg>`,
	},
	share: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M229.66,109.66l-48,48A8,8,0,0,1,168,152V112h-3a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h3V56a8,8,0,0,1,13.66-5.66l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M229.66,109.66l-48,48A8,8,0,0,1,168,152V112h-3a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h3V56a8,8,0,0,1,13.66-5.66l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"/></svg>`,
	},
	shield: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Z"/></svg>`,
	},
	'sliders-horizontal': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M32,80a8,8,0,0,1,8-8H77.17a28,28,0,0,1,53.66,0H216a8,8,0,0,1,0,16H130.83a28,28,0,0,1-53.66,0H40A8,8,0,0,1,32,80Zm184,88H194.83a28,28,0,0,0-53.66,0H40a8,8,0,0,0,0,16H141.17a28,28,0,0,0,53.66,0H216a8,8,0,0,0,0-16Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M32,80a8,8,0,0,1,8-8H77.17a28,28,0,0,1,53.66,0H216a8,8,0,0,1,0,16H130.83a28,28,0,0,1-53.66,0H40A8,8,0,0,1,32,80Zm184,88H194.83a28,28,0,0,0-53.66,0H40a8,8,0,0,0,0,16H141.17a28,28,0,0,0,53.66,0H216a8,8,0,0,0,0-16Z"/></svg>`,
	},
	smiley: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM92,96a12,12,0,1,1-12,12A12,12,0,0,1,92,96Zm82.92,60c-10.29,17.79-27.39,28-46.92,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.08-20a8,8,0,1,1,13.84,8ZM164,120a12,12,0,1,1,12-12A12,12,0,0,1,164,120Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM92,96a12,12,0,1,1-12,12A12,12,0,0,1,92,96Zm82.92,60c-10.29,17.79-27.39,28-46.92,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.08-20a8,8,0,1,1,13.84,8ZM164,120a12,12,0,1,1,12-12A12,12,0,0,1,164,120Z"/></svg>`,
	},
	spinner: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="128" y1="32" x2="128" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="195.88" y1="60.12" x2="173.25" y2="82.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="224" y1="128" x2="192" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="195.88" y1="195.88" x2="173.25" y2="173.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="128" y1="224" x2="128" y2="192" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="60.12" y1="195.88" x2="82.75" y2="173.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="32" y1="128" x2="64" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="60.12" y1="60.12" x2="82.75" y2="82.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="128" y1="32" x2="128" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="195.88" y1="60.12" x2="173.25" y2="82.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="224" y1="128" x2="192" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="195.88" y1="195.88" x2="173.25" y2="173.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="128" y1="224" x2="128" y2="192" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="60.12" y1="195.88" x2="82.75" y2="173.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="32" y1="128" x2="64" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="60.12" y1="60.12" x2="82.75" y2="82.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm33.94,58.75,17-17a8,8,0,0,1,11.32,11.32l-17,17a8,8,0,0,1-11.31-11.31ZM48,136a8,8,0,0,1,0-16H72a8,8,0,0,1,0,16Zm46.06,37.25-17,17a8,8,0,0,1-11.32-11.32l17-17a8,8,0,0,1,11.31,11.31Zm0-79.19a8,8,0,0,1-11.31,0l-17-17A8,8,0,0,1,77.09,65.77l17,17A8,8,0,0,1,94.06,94.06ZM136,208a8,8,0,0,1-16,0V184a8,8,0,0,1,16,0Zm0-136a8,8,0,0,1-16,0V48a8,8,0,0,1,16,0Zm54.23,118.23a8,8,0,0,1-11.32,0l-17-17a8,8,0,0,1,11.31-11.31l17,17A8,8,0,0,1,190.23,190.23ZM208,136H184a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16Z"/></svg>`,
	},
	trash: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"/></svg>`,
	},
	'upload-simple': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM88,80h32v64a8,8,0,0,0,16,0V80h32a8,8,0,0,0,5.66-13.66l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,88,80Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM88,80h32v64a8,8,0,0,0,16,0V80h32a8,8,0,0,0,5.66-13.66l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,88,80Z"/></svg>`,
	},
	user: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z"/></svg>`,
	},
	users: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/></svg>`,
	},
	warning: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/></svg>`,
	},
	'warning-circle': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"/></svg>`,
	},
	'wifi-slash': {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="48" y1="40" x2="208" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="204" r="12"/><path d="M71.6,66A163.53,163.53,0,0,0,24,93.19" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M232,93.19A163.31,163.31,0,0,0,128,56a165.48,165.48,0,0,0-21,1.33" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M107.78,105.76A115.46,115.46,0,0,0,56,129" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M200,129a115.57,115.57,0,0,0-48.38-22.63" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M154.81,157.49A68.1,68.1,0,0,0,88,165" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="48" y1="40" x2="208" y2="216" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="204" r="12"/><path d="M71.6,66A163.53,163.53,0,0,0,24,93.19" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M232,93.19A163.31,163.31,0,0,0,128,56a165.48,165.48,0,0,0-21,1.33" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M107.78,105.76A115.46,115.46,0,0,0,56,129" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M200,129a115.57,115.57,0,0,0-48.38-22.63" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M154.81,157.49A68.1,68.1,0,0,0,88,165" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M213.92,210.62a8,8,0,1,1-11.84,10.76l-33.67-37-28.1,33.88A15.93,15.93,0,0,1,128,224h0a15.93,15.93,0,0,1-12.31-5.77L11.65,92.8A15.65,15.65,0,0,1,8.11,80.91,15.93,15.93,0,0,1,14.28,70.1,188.26,188.26,0,0,1,46.6,50.35l-4.29-4.72a8.22,8.22,0,0,1,.13-11.38,8,8,0,0,1,11.48.37Zm34-129.71a15.93,15.93,0,0,0-6.17-10.81A186.67,186.67,0,0,0,128,32a191,191,0,0,0-42.49,4.75,4,4,0,0,0-2,6.59L186,156.07a4,4,0,0,0,6-.14L244.35,92.8A15.65,15.65,0,0,0,247.89,80.91Z"/></svg>`,
	},
	x: {
		default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="200" y1="56" x2="56" y2="200" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="200" y1="200" x2="56" y2="56" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		regular: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="200" y1="56" x2="56" y2="200" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="200" y1="200" x2="56" y2="56" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`,
		fill: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM181.66,170.34a8,8,0,0,1-11.32,11.32L128,139.31,85.66,181.66a8,8,0,0,1-11.32-11.32L116.69,128,74.34,85.66A8,8,0,0,1,85.66,74.34L128,116.69l42.34-42.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>`,
	},
};

const icons: { [key: string]: string } = {
	circle: `
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        `,
	'pubhubs-home': `
        <circle cx="12" cy="12" r="11" fill="currentColor"/>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.25306 12.2951L17.0548 0.626046L13.3499 17.5472L0.548216 29.2163L4.25306 12.2951Z" fill="black" stroke="black" stroke-linejoin="round" transform="scale(0.5) translate(15,9)"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
        </svg>
        `,
	close: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
        `,
	plus: `
        <svg viewBox="0 0 52 52" fill="none">
        <path d="M23 0H29V52H23V0Z" fill="currentColor"/>
        <path d="M52 24L52 30L-2.62268e-07 30L0 24L52 24Z" fill="currentColor"/>
        </svg>
        `,
	remove: `
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
        `,
	check: `
        <svg viewBox="0 0 12 12" stroke="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke="none" stroke-width="1" fill="currentColor" fill-rule="evenodd">
        <g fill="currentColor">
        <path d="M6,12 C9.31371,12 12,9.31371 12,6 C12,2.68629 9.31371,0 6,0 C2.68629,0 0,2.68629 0,6 C0,9.31371 2.68629,12 6,12 Z M9.05078,4.32009 C9.22756,4.10795 9.1989,3.79267 8.98676,3.61589 C8.77462,3.43911 8.45934,3.46777 8.28256,3.67991 L5.37791,7.16548 L4.41603,5.72265 C4.26285,5.49289 3.95241,5.4308 3.72265,5.58397 C3.49289,5.73715 3.4308,6.04759 3.58397,6.27735 L4.91731,8.27735 C5.00481,8.40861 5.14913,8.49087 5.30666,8.49929 C5.46419,8.5077 5.61645,8.44128 5.71744,8.32009 L9.05078,4.32009 Z"></path>
        </g>
        </g>
        </svg>
        `,
	'chevron-right': `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <polyline points="9 6 15 12 9 18" />
        `,
	'chevron-down': `
        <path stroke="none" d="M0 0h24v24H0z" />
        <polyline points="6 9 12 15 18 9" />
        `,
	'chevron-up': `
        <path stroke="none" d="M0 0h24v24H0z" />
        <polyline points="6 15 12 9 18 15" />
        `,
	cog: `
        <svg viewBox="0 0 58 58" stroke="none" fill="none">
        <path stroke="none"  fill="currentColor" d="M57.4639 25.0575L49.7253 24.3018C49.1872 21.9122 48.2437 19.6749 46.9756 17.6671L51.9151 11.6593C52.109 11.4239 52.0912 11.0817 51.8776 10.8661L47.1339 6.12244C46.9203 5.9088 46.5761 5.891 46.3407 6.08486L40.3329 11.0244C38.3251 9.75436 36.0878 8.81078 33.6982 8.27271L32.9425 0.534106C32.9128 0.231446 32.6576 0 32.355 0H25.647C25.3424 0 25.0892 0.229468 25.0575 0.534106L24.3018 8.27271C21.9122 8.81276 19.6769 9.75436 17.6671 11.0224L11.6593 6.08486C11.4239 5.891 11.0817 5.9088 10.8661 6.12244L6.12244 10.8661C5.90682 11.0797 5.891 11.4239 6.08288 11.6593L11.0224 17.6671C9.75239 19.6749 8.81078 21.9122 8.27271 24.3018L0.534106 25.0575C0.231446 25.0872 0 25.3424 0 25.645V32.353C0 32.6576 0.231446 32.9108 0.534106 32.9425L8.27271 33.6982C8.81276 36.0878 9.75436 38.3251 11.0224 40.3329L6.08288 46.3407C5.88902 46.5761 5.90682 46.9183 6.12244 47.1339L10.8661 51.8776C11.0817 52.0932 11.4239 52.109 11.6593 51.9171L17.6671 46.9776C19.6749 48.2476 21.9122 49.1892 24.3018 49.7273L25.0575 57.4659C25.0872 57.7686 25.3424 58 25.647 58H32.355C32.6596 58 32.9128 57.7686 32.9425 57.4659L33.6982 49.7273C36.0878 49.1892 38.3251 48.2456 40.3329 46.9776L46.3407 51.9171C46.5761 52.109 46.9183 52.0932 47.1339 51.8776L51.8776 47.1339C52.0912 46.9183 52.109 46.5741 51.9151 46.3407L46.9776 40.3329C48.2456 38.3251 49.1872 36.0878 49.7273 33.6982L57.4659 32.9425C57.7686 32.9128 58 32.6576 58 32.353V25.645C58 25.3404 57.7705 25.0872 57.4659 25.0575H57.4639ZM28.996 42.4437C21.572 42.4437 15.5524 36.4241 15.5524 29C15.5524 21.5759 21.572 15.5563 28.996 15.5563C36.4201 15.5563 42.4397 21.5759 42.4397 29C42.4397 36.4241 36.4201 42.4437 28.996 42.4437Z"/>
        </svg>
    `,
	edit: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <path d="M9 7 h-3a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-3" />
        <path d="M9 15h3l8.5 -8.5a1.5 1.5 0 0 0 -3 -3l-8.5 8.5v3" />
        <line x1="16" y1="5" x2="19" y2="8" />
        `,
	talk: `
        <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <path d="M21.641789,13.3147778 C22.0252911,18.8215755 17.7986006,23.5980192 12.204769,23.9755213 C9.20358535,24.1806892 6.41083623,23.0726829 4.41839164,21.1605054 L0,21.439507 L2.55933113,18.7477085 C1.88406065,17.5331016 1.46723996,16.1543438 1.35886435,14.6853188 C0.983717226,9.17852105 5.21036278,4.40212572 10.8042111,4.02461092 C16.3980593,3.64709478 21.2499534,7.80797997 21.6334556,13.3147778 L21.641789,13.3147778 Z" fill="currentColor"></path>
        </g>
        `,
	speech_bubbles: `
        <svg viewBox="0 0 74 58" xmlns="http://www.w3.org/2000/svg" >
        <g clip-path="url(#clip0_2274_19562)">
        <path fill="var(--accent-primary)" stroke="var(--accent-primary)" d="M48.9064 33.8534C49.773 46.298 40.2216 57.092 27.5805 57.9451C20.7984 58.4088 14.4873 55.905 9.98475 51.5837L0 52.2143L5.78362 46.1311C4.25765 43.3862 3.31569 40.2705 3.07078 36.9507C2.22302 24.5061 11.7745 13.7121 24.4155 12.859C37.0566 12.0059 48.021 21.4089 48.8876 33.8534H48.9064Z" fill="black"/>
        </g>
        <path fill="var(--on-surface)" stroke="var(--on-surface)" d="M24.9119 21.0482C24.0453 33.4928 33.5968 44.2868 46.2379 45.1399C53.0199 45.6035 59.3311 43.0998 63.8336 38.7785L73.8184 39.4091L68.0347 33.3259C69.5607 30.581 70.5027 27.4652 70.7476 24.1454C71.5953 11.7009 62.0439 0.906886 49.4028 0.0537551C36.7618 -0.799376 25.7974 8.60361 24.9308 21.0482H24.9119Z" fill="white"/>
        <defs>
        <clipPath  id="clip0_2274_19562">
        <rect  width="48.961" height="45.1948" fill="white" transform="translate(0 12.8052)"/>
        </clipPath>
        </defs>
        </svg>
        `,
	send: `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M120-160v-240l320-80-320-80v-240l760 320-760 320Z"/></svg>
        `,
	search: `
        <svg viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="4.5" r="4.25" stroke="currentColor" stroke-width="0.5"/>
        <path d="M0.823223 12.3232C0.725592 12.4209 0.725592 12.5791 0.823223 12.6768C0.920854 12.7744 1.07915 12.7744 1.17678 12.6768L0.823223 12.3232ZM5.32322 7.82322L0.823223 12.3232L1.17678 12.6768L5.67678 8.17678L5.32322 7.82322Z" fill="currentColor"/>
        </svg>
        `,
	emoticon: `
        <svg viewBox="0 0 58 58" stroke="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
        <mask id="clipout">
        <rect width="58" height="58" fill="white"/>
        <path fill="black" d="M22.6957 23.9565C22.6957 27.4383 21.5666 30.2609 20.1739 30.2609C18.7812 30.2609 17.6522 27.4383 17.6522 23.9565C17.6522 20.4747 18.7812 17.6522 20.1739 17.6522C21.5666 17.6522 22.6957 20.4747 22.6957 23.9565Z" />
        <path fill="black" d="M40.3478 23.9565C40.3478 27.4383 39.2188 30.2609 37.8261 30.2609C36.4334 30.2609 35.3043 27.4383 35.3043 23.9565C35.3043 20.4747 36.4334 17.6522 37.8261 17.6522C39.2188 17.6522 40.3478 20.4747 40.3478 23.9565Z" />
        <path fill="black" fill-rule="evenodd" clip-rule="evenodd" d="M16.8087 39.4107C17.3263 38.9448 18.1235 38.9868 18.5894 39.5043C19.2155 40.2 20.7048 41.3757 22.6546 42.3787C24.5959 43.3773 26.8515 44.1303 29 44.1303C31.1437 44.1303 33.3335 43.3804 35.2438 42.3824C37.1484 41.3873 38.6791 40.1959 39.4783 39.4348C39.9826 38.9545 40.7807 38.974 41.2609 39.4783C41.7411 39.9826 41.7217 40.7807 41.2174 41.2609C40.2513 42.1809 38.529 43.5111 36.4115 44.6174C34.2996 45.7208 31.6981 46.652 29 46.652C26.3068 46.652 23.645 45.7239 21.5011 44.6211C19.3657 43.5227 17.602 42.1768 16.715 41.1913C16.2492 40.6737 16.2911 39.8765 16.8087 39.4107Z"/>
        </mask>
        </defs>
        <path fill="currentColor" d="M58 29C58 45.0163 45.0163 58 29 58C12.9837 58 0 45.0163 0 29C0 12.9837 12.9837 0 29 0C45.0163 0 58 12.9837 58 29Z" mask="url(#clipout)" />
        </svg>
        `,
	paperclip: `
        <svg viewBox="0 0 78 59" stroke="none" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="var(--accent-secondary)" d="M1.68239 16.9486C0.769413 14.3913 2.1024 11.5781 4.65971 10.6651L29.9028 1.65312C32.4601 0.740142 35.2733 2.07313 36.1863 4.63043L49.5459 42.0514C50.4589 44.6087 49.1259 47.4219 46.5686 48.3349L21.3255 57.3469C18.7682 58.2599 15.955 56.9269 15.042 54.3696L1.68239 16.9486Z" />
        <path fill="var(--on-accent-secondary)" d="M6.85639 19.1297C6.65471 18.5698 6.9451 17.9524 7.505 17.7507L31.8359 8.98635C32.3958 8.78467 33.0132 9.07506 33.2149 9.63496C33.4166 10.1949 33.1262 10.8122 32.5663 11.0139L8.23536 19.7783C7.67546 19.98 7.05808 19.6896 6.85639 19.1297Z" />
        <path fill="var(--on-accent-secondary)" d="M9.4726 25.626C9.27092 25.0661 9.56131 24.4487 10.1212 24.2471L34.537 15.4521C35.0969 15.2504 35.7143 15.5408 35.916 16.1007C36.1177 16.6606 35.8273 17.278 35.2674 17.4797L10.8516 26.2746C10.2917 26.4763 9.67429 26.1859 9.4726 25.626Z" />
        <path fill="var(--on-accent-secondary)" d="M13.3242 34.4127C13.1225 33.8528 13.4129 33.2354 13.9728 33.0337L38.8489 24.0729C39.4088 23.8712 40.0261 24.1616 40.2278 24.7215C40.4295 25.2814 40.1391 25.8988 39.5792 26.1005L14.7031 35.0613C14.1432 35.2629 13.5259 34.9726 13.3242 34.4127Z" />
        <path fill="var(--on-accent-secondary)" d="M15.4794 40.8753C15.2778 40.3154 15.5681 39.698 16.128 39.4964L41.0041 30.5356C41.564 30.3339 42.1814 30.6243 42.3831 31.1842C42.5848 31.7441 42.2944 32.3615 41.7345 32.5632L16.8584 41.5239C16.2985 41.7256 15.6811 41.4352 15.4794 40.8753Z" />
        <path fill="var(--on-accent-secondary)" d="M19.7919 51.6521C19.5903 51.0922 19.8806 50.4748 20.4405 50.2731L26.8381 47.9686C27.398 47.7669 28.0154 48.0573 28.2171 48.6172C28.4188 49.1771 28.1284 49.7945 27.5685 49.9962L21.1709 52.3007C20.611 52.5024 19.9936 52.212 19.7919 51.6521Z" />
        <path fill="var(--on-accent-primary)" d="M36.2526 15.5665C36.7074 12.8895 39.2463 11.0881 41.9233 11.543L72.7141 16.7747C75.3911 17.2296 77.1925 19.7685 76.7376 22.4455L71.5059 53.2362C71.051 55.9132 68.5121 57.7147 65.8351 57.2598L35.0444 52.028C32.3674 51.5732 30.566 49.0343 31.0208 46.3573L36.2526 15.5665Z" />
        <path fill="black" d="M63.2519 36.4052C63.9342 36.5242 64.3909 37.1737 64.2719 37.856C64.1529 38.5382 63.5034 38.9949 62.8211 38.8759L43.0552 35.4291C42.373 35.3102 41.9163 34.6606 42.0353 33.9783C42.1543 33.2961 42.8038 32.8394 43.4861 32.9584L63.2519 36.4052Z" />
        <path fill="black" d="M53.641 25.8188C53.76 25.1365 54.4095 24.6799 55.0918 24.7989C55.7741 24.9178 56.2307 25.5674 56.1118 26.2496L52.7596 45.4727C52.6406 46.155 51.9911 46.6116 51.3088 46.4927C50.6266 46.3737 50.1699 45.7242 50.2889 45.0419L53.641 25.8188Z" />
        </svg>
        `,
	shield: `
        <svg viewBox="0 0 16 18">
            <path fill="currentColor" stroke="currentColor" d="M15.1176 4.48959L8.17454 1L1 4.48959C2.15718 9.2003 4.93443 16.0733 8.17454 17C11.6461 15.8416 14.269 9.2003 15.1176 4.48959Z" stroke-linejoin="round"/>
        </svg>
        `,
	'arrow-right': `
        <path stroke="none" d="M0 0h24v24H0z"/>  <line x1="5" y1="12" x2="19" y2="12" />  <line x1="15" y1="16" x2="19" y2="12" />  <line x1="15" y1="8" x2="19" y2="12" />
        `,
	arrow: `
        <svg viewBox="0 0 34 15" fill="none" >
        <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M0.292893 8.07107C-0.0976311 7.68054 -0.0976311 7.04738 0.292893 6.65685L6.65685 0.292893C7.04738 -0.0976311 7.68054 -0.0976311 8.07107 0.292893C8.46159 0.683418 8.46159 1.31658 8.07107 1.70711L3.41421 6.36396H33C33.5523 6.36396 34 6.81168 34 7.36396C34 7.91625 33.5523 8.36396 33 8.36396H3.41421L8.07107 13.0208C8.46159 13.4113 8.46159 14.0445 8.07107 14.435C7.68054 14.8256 7.04738 14.8256 6.65685 14.435L0.292893 8.07107Z" />
        </svg>
        `,
	reply: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
        `,
	closingCross: `
        <path stroke="none" d="M0 0h24v24H0z"/>  <line x1="18" y1="6" x2="6" y2="18" />  <line x1="6" y1="6" x2="18" y2="18" />
        `,
	'lost-connection': `
        <line x1="1" y1="1" x2="23" y2="23" />  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />  <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />  <line x1="12" y1="20" x2="12.01" y2="20" />
    `,
	refresh: `
        <path stroke="none" d="M0 0h24v24H0z"/>  <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -5v5h5" />  <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 5v-5h-5" />
    `,
	bin: `<path stroke="none" d="M0 0h24v24H0z"/>  <line x1="4" y1="7" x2="20" y2="7" />  <line x1="10" y1="11" x2="10" y2="17" />  <line x1="14" y1="11" x2="14" y2="17" />  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />  <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />`,
	person: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill="currentColor" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>`,
	spinner: `<line x1="12" y1="2" x2="12" y2="6" />  <line x1="12" y1="18" x2="12" y2="22" />  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />  <line x1="2" y1="12" x2="6" y2="12" />  <line x1="18" y1="12" x2="22" y2="12" />  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />`,
	sign: `
        <svg viewBox="0 0 92 58" stroke="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.3899 55.7581C20.3418 57.0001 18.8187 57.9555 16.8332 57.9555C13.0823 57.9555 11.2122 55.1056 10.3203 52.7592C9.41211 50.37 9.02055 47.3514 8.73519 44.7143C8.67067 44.118 8.61136 43.5403 8.55415 42.983C8.34 40.8971 8.15519 39.0969 7.83592 37.6763C7.7668 37.3687 7.69847 37.1153 7.63445 36.9088C7.40295 37.142 7.13023 37.5352 6.83703 38.1976C6.20307 39.6296 5.90625 41.4816 5.85584 42.7433C5.793 44.3161 4.44109 45.5412 2.83627 45.4796C1.23145 45.4181 -0.0185787 44.0931 0.0442614 42.5203C0.11251 40.8121 0.492052 38.2092 1.50152 35.9289C2.46281 33.7574 4.502 30.872 8.28971 30.872C10.2101 30.872 11.4979 31.9905 12.2254 33.097C12.8944 34.1143 13.2683 35.3488 13.5158 36.4502C13.916 38.2306 14.1456 40.4833 14.3623 42.6084C14.4145 43.1202 14.4659 43.6246 14.5188 44.1132C14.8119 46.8219 15.1545 49.1491 15.7704 50.7694C16.0723 51.5636 16.3597 51.9619 16.5438 52.136C16.6393 52.2264 16.6855 52.2498 16.7834 52.2544C16.8108 52.231 16.853 52.1907 16.9083 52.1251C17.1833 51.7993 17.5391 51.147 17.9034 50.0156C18.5933 47.873 19.0291 44.9826 19.5203 41.724C19.5492 41.5323 19.5783 41.3392 19.6077 41.145C20.1088 37.8293 20.6888 34.136 21.7623 31.2698C22.7706 28.5779 24.788 25.1698 28.9364 25.1698C30.8851 25.1698 32.4895 25.964 33.6554 27.2553C34.7243 28.4393 35.3415 29.941 35.7405 31.3575C36.5039 34.0676 36.7412 37.547 36.9546 40.6764C36.9622 40.7878 36.9697 40.8987 36.9773 41.0092C37.211 44.4243 37.4397 47.4557 38.0788 49.6986C38.7468 52.0429 39.4607 52.2369 39.7912 52.2728C41.2038 52.4267 41.9463 51.8948 42.5133 51.0518C43.1994 50.0316 43.4712 48.6741 43.4712 47.9776C43.4712 46.4036 44.7732 45.1276 46.3793 45.1276C47.9853 45.1276 49.2873 46.4036 49.2873 47.9776C49.2873 49.5722 48.7934 52.0714 47.3693 54.1888C45.8262 56.4833 43.1141 58.3698 39.1489 57.938C35.0378 57.4904 33.2821 54.0567 32.4771 51.2318C31.6487 48.3246 31.399 44.674 31.1786 41.454L31.1743 41.3906C30.9391 37.9536 30.7316 34.9952 30.1342 32.8744C29.8392 31.8271 29.5238 31.2808 29.2997 31.0326C29.1726 30.8919 29.1235 30.8698 28.9364 30.8698L28.933 30.8698C28.8007 30.8696 28.1082 30.8686 27.2221 33.2341C26.3934 35.4465 25.8832 38.5246 25.3609 41.9802C25.3238 42.226 25.2866 42.4739 25.2491 42.7234C24.7868 45.8016 24.2867 49.1319 23.4498 51.731C22.9965 53.1389 22.365 54.6027 21.3899 55.7581Z"/>
        <path fill="currentColor" d="M80.9055 1.87173C82.1264 0.838001 83.9542 0.989762 84.9879 2.2107L89.9953 8.12486C91.029 9.34579 90.8772 11.1736 89.6563 12.2073L59.4893 37.7488L50.7385 27.4132L80.9055 1.87173Z"/>
        <path fill="currentColor" d="M50.3534 40.0131C48.026 40.59 46.0456 38.2509 46.9984 36.0505L50.7385 27.4132L59.4893 37.7488L50.3534 40.0131Z"/>
        </svg>
    `,
	upload: `
        <path stroke="none" d="M0 0h24v24H0z"/>  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />  <polyline points="7 9 12 4 17 9" />  <line x1="12" y1="4" x2="12" y2="16" />
        `,
	// Added for polling
	scheduler: `
		<svg class="h-8 w-8" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">  <path stroke="none" d="M0 0h24v24H0z"/>  <rect x="4" y="5" width="16" height="16" rx="2" />  <line x1="16" y1="3" x2="16" y2="7" />  <line x1="8" y1="3" x2="8" y2="7" />  <line x1="4" y1="11" x2="20" y2="11" />  <rect x="8" y="15" width="2" height="2" /></svg>
		`,
	// Added for polling
	poll: `
		<svg class="h-8 w-8 fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/> </svg>
		`,
	warning: `
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />  <line x1="12" y1="9" x2="12" y2="13" />  <line x1="12" y1="17" x2="12.01" y2="17" />
        `,
	info: `
        <circle cx="12" cy="12" r="10" />  <line x1="12" y1="16" x2="12" y2="12" />  <line x1="12" y1="8" x2="12.01" y2="8" />
        `,
	hubBlockInfo: `
        <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M12 7C12.8284 7 13.5 6.32843 13.5 5.5C13.5 4.67157 12.8284 4 12 4C11.1716 4 10.5 4.67157 10.5 5.5C10.5 6.32843 11.1716 7 12 7ZM11 9C10.4477 9 10 9.44772 10 10C10 10.5523 10.4477 11 11 11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V10C13 9.44772 12.5523 9 12 9H11Z" fill="#000000"></path> </g></svg>
	`,
	download: `
        <path stroke="none" d="M0 0h24v24H0z"/>  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />  <polyline points="7 11 12 16 17 11" />  <line x1="12" y1="4" x2="12" y2="16" />
        `,
	single_user: `<svg  width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">  <path stroke="none" d="M0 0h24v24H0z"/>  <circle cx="12" cy="7" r="4" />  <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>`,
	two_users: `<svg  width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">  <path stroke="none" d="M0 0h24v24H0z"/>  <circle cx="9" cy="7" r="4" />  <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />  <path d="M16 3.13a4 4 0 0 1 0 7.75" />  <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>`,
	filled_tick: `<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 48 48" width="24px" height="24px" baseProfile="basic"><circle cx="24" cy="24" r="20" fill="#6be3a2"/><path fill="#324561" d="M22.5,33c-0.226,0-0.446-0.076-0.625-0.219l-7.5-6c-0.431-0.345-0.501-0.974-0.156-1.405	c0.347-0.431,0.975-0.501,1.406-0.156l6.667,5.334l9.889-14.126c0.316-0.454,0.94-0.562,1.393-0.246	c0.453,0.317,0.562,0.94,0.246,1.393l-10.5,15c-0.158,0.227-0.403,0.377-0.677,0.417C22.595,32.997,22.547,33,22.5,33z"/></svg>`,

	// Added for polling
	checkmark: `
			<path stroke="none" d="M0 0h24v24H0z"/>  <path d="M5 12l5 5l10 -10" />
			`,
	// Added for polling
	checkmark_circle: `
		<path stroke="none" d="M0 0h24v24H0z"/>
		<circle cx="12" cy="12" r="9" />
		<path d="M9 12l2 2l4 -4" />
	`,

	// Added for polling
	map_pin: `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
  			<path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
		</svg>
	`,

	// Added for polling
	scheduler_lock: `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"">
			<path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2m-6 9c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2m3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1c1.71 0 3.1 1.39 3.1 3.1z"/>
		</svg>
	`,

	// Added for polling
	voting_widget_options: `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
			<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
				<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
			</g>
		</svg>
	`,

	emoji_clock: `
        <svg viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7.23145" r="6.5" stroke="currentColor"/>
        <path d="M7 3.23145V7.23145H10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        `,
	emoji_smiley: `
        <svg viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7.23145" r="6.5" stroke="currentColor"/>
        <path d="M5 4.23145V6.23145" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 4.23145V6.23145" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9.76391 8.23145H4.23609C4.1125 8.23145 4.01835 8.34196 4.04665 8.46227C4.29293 9.5095 5.14423 11.2314 7 11.2314C8.85577 11.2314 9.70707 9.5095 9.95335 8.46227C9.98165 8.34196 9.8875 8.23145 9.76391 8.23145Z" fill="currentColor"/>
        </svg>
        `,
	emoji_bear: `
        <svg viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M2.70629 9.73493C2.52513 10.7874 2.54624 11.5968 2.69528 12.0158C2.78468 12.2671 3.01193 12.4942 3.43769 12.6838C3.86337 12.8733 4.42263 12.9945 5.04992 13.0657C6.02313 13.1763 7.05438 13.1582 7.85543 13.1442C8.09274 13.14 8.30984 13.1362 8.49926 13.1362C8.68908 13.1362 8.90656 13.14 9.1442 13.1442C9.94602 13.1582 10.9774 13.1762 11.9505 13.0657C12.5778 12.9945 13.1369 12.8733 13.5625 12.6838C13.9881 12.4943 14.2153 12.2671 14.3047 12.0158C14.4538 11.5968 14.4748 10.7875 14.2935 9.73499C14.1165 8.70776 13.761 7.52973 13.2392 6.41894C12.1722 4.14741 10.531 2.38551 8.49926 2.38551C6.46754 2.38551 4.82676 4.14735 3.76012 6.41888C3.23852 7.52965 2.88311 8.70769 2.70629 9.73493ZM2.78532 5.96114C3.88818 3.6125 5.7975 1.30859 8.49926 1.30859C11.201 1.30859 13.1107 3.61244 14.2139 5.96108C14.7773 7.16038 15.1617 8.43103 15.3548 9.55217C15.5436 10.6481 15.5648 11.6868 15.3194 12.3767C15.0932 13.0124 14.571 13.4136 14.0006 13.6676C13.4301 13.9216 12.7466 14.0592 12.072 14.1358C11.0196 14.2553 9.88167 14.235 9.07825 14.2206C8.85694 14.2166 8.66102 14.2131 8.49926 14.2131C8.33789 14.2131 8.14234 14.2166 7.92138 14.2206C7.11877 14.2349 5.98092 14.2553 4.92841 14.1358C4.2538 14.0592 3.57025 13.9216 2.99969 13.6676C2.42922 13.4136 1.90681 13.0125 1.68065 12.3767C1.43523 11.6868 1.45634 10.6481 1.64498 9.55224C1.83796 8.4311 2.22216 7.16045 2.78532 5.96114Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M13.3761 1.51882C12.8759 1.86028 12.4563 2.54266 12.2319 3.10359C12.1214 3.3797 11.8081 3.51399 11.532 3.40353C11.2559 3.29308 11.1216 2.97971 11.232 2.7036C11.4907 2.05693 12.0131 1.14531 12.7689 0.62938C13.1599 0.362511 13.6384 0.185537 14.1791 0.241936C14.718 0.298157 15.2401 0.578108 15.7358 1.07373C16.2314 1.56935 16.5114 2.09146 16.5677 2.63039C16.6241 3.17104 16.4471 3.64961 16.1802 4.04056C15.6642 4.79637 14.7525 5.31884 14.1058 5.57757C13.8297 5.68803 13.5163 5.55375 13.4059 5.27764C13.2954 5.00154 13.4297 4.68816 13.7058 4.5777C14.2668 4.35326 14.9493 3.93362 15.2908 3.43338C15.4526 3.1963 15.5202 2.96837 15.4966 2.74214C15.4728 2.51421 15.3482 2.2091 14.9743 1.83526C14.6004 1.46141 14.2953 1.33682 14.0673 1.31304C13.8411 1.28944 13.6131 1.357 13.3761 1.51882Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M3.62587 1.51882C4.12607 1.86028 4.54566 2.54266 4.77005 3.10359C4.8805 3.3797 5.19388 3.51399 5.46999 3.40353C5.7461 3.29308 5.88039 2.97971 5.76993 2.7036C5.51124 2.05693 4.98883 1.14531 4.23303 0.62938C3.84209 0.362511 3.36352 0.185537 2.82289 0.241936C2.28397 0.298157 1.76184 0.578108 1.26618 1.07373C0.770513 1.56935 0.490524 2.09146 0.434295 2.63039C0.377888 3.17104 0.554887 3.64961 0.821773 4.04056C1.33774 4.79637 2.24943 5.31884 2.89613 5.57757C3.17224 5.68803 3.48562 5.55375 3.59608 5.27764C3.70654 5.00154 3.57226 4.68816 3.29615 4.5777C2.73517 4.35326 2.0527 3.93362 1.7112 3.43338C1.54936 3.1963 1.4818 2.96837 1.5054 2.74214C1.52918 2.51421 1.65377 2.2091 2.02764 1.83526C2.40152 1.46141 2.70666 1.33682 2.93463 1.31304C3.16088 1.28944 3.38881 1.357 3.62587 1.51882Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0.7" clip-rule="evenodd" d="M8.50134 9.25098C8.57569 9.25098 8.63596 9.31125 8.63596 9.38559C8.63596 9.73514 8.68885 10.2569 8.84338 10.6861C9.00148 11.1253 9.23982 11.4048 9.57826 11.4048C9.96516 11.4048 10.194 11.2466 10.3306 11.0569C10.4721 10.8604 10.5206 10.6205 10.5206 10.4625C10.5206 10.3882 10.5808 10.3279 10.6552 10.3279C10.7295 10.3279 10.7898 10.3882 10.7898 10.4625C10.7898 10.6635 10.7306 10.9621 10.549 11.2142C10.3625 11.4733 10.0529 11.674 9.57826 11.674C9.05517 11.674 8.75505 11.2356 8.59007 10.7773C8.55601 10.6827 8.5266 10.5846 8.50134 10.4851C8.47609 10.5846 8.44667 10.6827 8.41262 10.7773C8.24764 11.2356 7.94752 11.674 7.42442 11.674C6.94978 11.674 6.64014 11.4733 6.45364 11.2142C6.27209 10.9621 6.21289 10.6635 6.21289 10.4625C6.21289 10.3882 6.27316 10.3279 6.34751 10.3279C6.42185 10.3279 6.48212 10.3882 6.48212 10.4625C6.48212 10.6205 6.53061 10.8604 6.67213 11.0569C6.80871 11.2466 7.03753 11.4048 7.42442 11.4048C7.76286 11.4048 8.0012 11.1253 8.1593 10.6861C8.31384 10.2569 8.36673 9.73514 8.36673 9.38559C8.36673 9.31125 8.427 9.25098 8.50134 9.25098Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M6.34705 5.61621C6.64444 5.61621 6.88551 5.85729 6.88551 6.15467V7.23159C6.88551 7.52897 6.64444 7.77005 6.34705 7.77005C6.04967 7.77005 5.80859 7.52897 5.80859 7.23159V6.15467C5.80859 5.85729 6.04967 5.61621 6.34705 5.61621Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M10.6556 5.61621C10.953 5.61621 11.1941 5.85729 11.1941 6.15467V7.23159C11.1941 7.52897 10.953 7.77005 10.6556 7.77005C10.3583 7.77005 10.1172 7.52897 10.1172 7.23159V6.15467C10.1172 5.85729 10.3583 5.61621 10.6556 5.61621Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="1" clip-rule="evenodd" d="M9.57812 8.84705C9.57812 9.14444 9.33705 9.38551 9.03967 9.38551L7.96275 9.38551C7.66536 9.38551 7.42429 9.14444 7.42429 8.84705C7.42429 8.54967 7.66536 8.30859 7.96275 8.30859L9.03967 8.30859C9.33705 8.30859 9.57812 8.54967 9.57812 8.84705Z" fill="currentColor"/>
        </svg>
        `,
	emoji_cup: `
        <svg viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 8.56478V1.23145H11V8.56478C11 9.787 10 12.2314 6 12.2314C2 12.2314 1 9.787 1 8.56478Z" stroke="currentColor" stroke-linejoin="round"/>
        <path d="M1.5 4.23145H10.5" stroke="currentColor" stroke-linejoin="round"/>
        <path d="M11.5 4.23145C12.5 4.23181 14 4.53145 14 5.73145C14 6.93145 12.5 7.23145 11.5 7.23145" stroke="currentColor" stroke-linejoin="round"/>
        <path d="M4 7.23145L4 8.23145" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 6.23145V9.23145" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        `,
	emoji_house: `
        <svg viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M5.2415 0.349208C5.6406 -0.116403 6.36092 -0.116402 6.76002 0.349209L11.6729 6.08091C12.2289 6.72959 11.768 7.7317 10.9136 7.7317H1.08787C0.233518 7.7317 -0.227393 6.72959 0.328613 6.08091L5.2415 0.349208ZM6.00076 1L1.08787 6.7317L10.9136 6.7317L6.00076 1Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M0.5 12.7314V7.23145H1.5V12.7314H10.5V7.23145H11.5V12.7314C11.5 13.2837 11.0523 13.7314 10.5 13.7314H1.5C0.947715 13.7314 0.5 13.2837 0.5 12.7314Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M3 10.3314C3 10.0001 3.26863 9.73145 3.6 9.73145H4.4C4.73137 9.73145 5 10.0001 5 10.3314V12.6314C5 12.9628 4.73137 13.2314 4.4 13.2314H3.6C3.26863 13.2314 3 12.9628 3 12.6314V10.3314Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M2.5 1.23145H3.5V3.73145H2.5V1.23145Z" fill="currentColor"/>
        <path fill-rule="evenodd" stroke-width="0" clip-rule="evenodd" d="M7 9.83145C7 9.50007 7.26863 9.23145 7.6 9.23145H8.4C8.73137 9.23145 9 9.50007 9 9.83145V10.6314C9 10.9628 8.73137 11.2314 8.4 11.2314H7.6C7.26863 11.2314 7 10.9628 7 10.6314V9.83145Z" fill="currentColor"/>
        </svg>

        `,
	emoji_basketball: `
        <svg viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7.23145" r="6.5" stroke="currentColor"/>
        <path d="M3.5 2.23145C4 3.06478 5 5.23145 5 7.23145C5 9.23145 3.66667 11.3981 3 12.2314" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10.5 2.23145C10 3.06478 9 5.23145 9 7.23145C9 9.23145 10.3333 11.3981 11 12.2314" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 1.23145V13.2314" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M1 7.23145H13" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        `,
	emoji_lightbulb: `
        <svg viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M5.25195 1.12C3.28525 1.12 1.69092 2.62432 1.69092 4.48H0.503906C0.503906 2.00576 2.62968 0 5.25195 0C7.87423 0 10 2.00576 10 4.48H8.81299C8.81299 2.62432 7.21866 1.12 5.25195 1.12Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M1.59066 8.1138C0.977609 7.36842 0.503906 6.26117 0.503906 4.48047H1.69092C1.69092 6.05977 2.10516 6.91252 2.52842 7.42714C2.7456 7.69119 2.98131 7.88614 3.21097 8.05497C3.28701 8.11087 3.35342 8.15761 3.42141 8.20546C3.4639 8.23536 3.507 8.26569 3.55346 8.29897C3.66151 8.37636 3.78177 8.46569 3.88647 8.56449C4.23412 8.89251 4.45048 9.20697 4.56006 9.58142C4.65771 9.91509 4.65761 10.2654 4.65751 10.6081C4.65751 10.6189 4.65751 10.6297 4.65751 10.6405H3.4705C3.4705 10.2469 3.46537 10.0487 3.41587 9.87952C3.37522 9.74063 3.29299 9.58843 3.04713 9.35645C3.00346 9.31524 2.93839 9.26457 2.83572 9.19103C2.80494 9.16899 2.76853 9.14333 2.72889 9.11539C2.6527 9.0617 2.56456 8.99958 2.48143 8.93847C2.21118 8.7398 1.89164 8.47974 1.59066 8.1138Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M8.00882 7.39144C8.41832 6.89298 8.81271 6.06642 8.81234 4.48072L9.99935 4.48047C9.99977 6.25477 9.55285 7.34011 8.94698 8.0776C8.65018 8.43888 8.33158 8.69623 8.05804 8.8977C7.96064 8.96944 7.87689 9.02905 7.80342 9.08133C7.65027 9.19033 7.54181 9.26753 7.44744 9.35657C7.07607 9.70698 7.02008 9.88487 7.00485 9.97541C6.99507 10.0335 6.99526 10.0981 7.00465 10.2083C7.00628 10.2275 7.00835 10.2492 7.01063 10.2731C7.01992 10.3707 7.03262 10.5041 7.03262 10.6406H5.84561C5.84561 10.5589 5.8392 10.4906 5.8308 10.4011C5.82786 10.3698 5.82469 10.336 5.82146 10.2981C5.81008 10.1646 5.80006 9.99266 5.83252 9.79975C5.90178 9.38828 6.14012 9.00617 6.60809 8.56461C6.76473 8.41682 6.97386 8.26796 7.15758 8.13717C7.21793 8.09422 7.27554 8.05321 7.32765 8.01483C7.56533 7.83978 7.79793 7.64814 8.00882 7.39144Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M3.4707 11.7596V10.6396H4.65771V11.1996H5.84473V10.6396H7.03174V11.7596C7.03174 12.0689 6.76602 12.3196 6.43823 12.3196H4.06421C3.73642 12.3196 3.4707 12.0689 3.4707 11.7596Z" fill="currentColor"/>
        <path stroke-width="0" d="M3.4707 13.4399C3.4707 13.1306 3.73642 12.8799 4.06421 12.8799H6.43823C6.76602 12.8799 7.03174 13.1306 7.03174 13.4399C7.03174 13.7492 6.76602 13.9999 6.43823 13.9999H4.06421C3.73642 13.9999 3.4707 13.7492 3.4707 13.4399Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M4.06421 12.8799C3.73642 12.8799 3.4707 13.1306 3.4707 13.4399C3.4707 13.7492 3.73642 13.9999 4.06421 13.9999H6.43823C6.76602 13.9999 7.03174 13.7492 7.03174 13.4399C7.03174 13.1306 6.76602 12.8799 6.43823 12.8799H4.06421Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M3.8545 4.84178C3.97038 4.73243 4.15828 4.73243 4.27417 4.84178L5.25134 5.76379L6.22852 4.84178C6.34441 4.73243 6.5323 4.73243 6.64819 4.84178C6.76408 4.95112 6.76408 5.12841 6.64819 5.23776L5.46118 6.35776C5.34529 6.4671 5.1574 6.4671 5.04151 6.35776L3.8545 5.23776C3.73861 5.12841 3.73861 4.95112 3.8545 4.84178Z" fill="currentColor"/>
        <path stroke-width="0" fill-rule="evenodd" clip-rule="evenodd" d="M5.25183 5.87988C5.41572 5.87988 5.54858 6.00524 5.54858 6.15988V7.83988C5.54858 7.99452 5.41572 8.11988 5.25183 8.11988C5.08794 8.11988 4.95508 7.99452 4.95508 7.83988V6.15988C4.95508 6.00524 5.08794 5.87988 5.25183 5.87988Z" fill="currentColor"/>
        </svg>
        `,
	emoji_signs: `
        <svg viewBox="0 0 18 13" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect stroke-width="1" x="0.5" y="0.5" width="17" height="12" rx="1.5" stroke="currentColor"/>
        <path stroke-width="0" d="M6.89219 10.0003C6.676 10.0003 6.51138 9.80644 6.54638 9.5931L7.62458 3.02123C7.65237 2.85186 7.79875 2.72754 7.97038 2.72754C8.18657 2.72754 8.35119 2.92137 8.31619 3.1347L7.23799 9.70657C7.2102 9.87595 7.06383 10.0003 6.89219 10.0003ZM3.58637 7.98322C3.36787 7.98322 3.20119 7.78776 3.23572 7.572C3.26328 7.39973 3.4119 7.27299 3.58637 7.27299H8.29325C8.51175 7.27299 8.67842 7.46845 8.6439 7.68421C8.61634 7.85649 8.46771 7.98322 8.29325 7.98322H3.58637ZM4.33537 10.0003C4.11918 10.0003 3.95456 9.80644 3.98956 9.5931L5.06776 3.02123C5.09555 2.85186 5.24193 2.72754 5.41357 2.72754C5.62975 2.72754 5.79437 2.92137 5.75937 3.1347L4.68117 9.70657C4.65339 9.87595 4.50701 10.0003 4.33537 10.0003ZM4.01251 5.45481C3.794 5.45481 3.62733 5.25936 3.66185 5.04359C3.68942 4.87132 3.83804 4.74458 4.01251 4.74458H8.71938C8.93789 4.74458 9.10456 4.94004 9.07004 5.1558C9.04247 5.32808 8.89385 5.45481 8.71938 5.45481H4.01251Z" fill="currentColor"/>
        <path stroke-width="0" d="M13.5126 2.72754C13.7783 2.72754 13.9926 2.94481 13.989 3.21045L13.9301 7.54292C13.927 7.7713 13.741 7.95481 13.5126 7.95481C13.2842 7.95481 13.0982 7.7713 13.0951 7.54292L13.0362 3.21045C13.0326 2.94481 13.2469 2.72754 13.5126 2.72754ZM13.5126 10.0571C13.3374 10.0571 13.1871 9.99435 13.0616 9.86887C12.9361 9.7434 12.8734 9.59307 12.8734 9.41788C12.8734 9.24269 12.9361 9.09236 13.0616 8.96689C13.1871 8.84141 13.3374 8.77868 13.5126 8.77868C13.6878 8.77868 13.8381 8.84141 13.9636 8.96689C14.0891 9.09236 14.1518 9.24269 14.1518 9.41788C14.1518 9.53388 14.1222 9.64042 14.063 9.73748C14.0062 9.83455 13.9293 9.91267 13.8322 9.97186C13.7375 10.0287 13.631 10.0571 13.5126 10.0571Z" fill="currentColor"/>
        </svg>
        `,
	emoji_flag: `
        <svg viewBox="0 0 9 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 2V14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 1.99994C7.5 1.49959 6 0.999131 4.5 1.99948C2.5427 3.30481 1.5 1.83391 1 1.50046V5.99959C1.66667 6.49959 2.9 7.20046 4.5 6.00046C6.1 4.80046 7.66667 5.83292 8 6.49959" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 2V6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        `,
	message: `
        <svg class="h-32 w-32 text-gray-700"  width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path stroke="none" d="M0 0h24v24H0z"/>
        <path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10" />
        <path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2" />
        </svg>`,
	mention: `
        <svg class="h-32 w-32 text-gray-700"  fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/>
        </svg>`,
	hub_fallback: `
        <path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M11.412 15.655 9.75 21.75l3.745-4.012M9.257 13.5H3.75l2.659-2.849m2.048-2.194L14.25 2.25 12 10.5h8.25l-4.707 5.043M8.457 8.457 3 3m5.457 5.457 7.086 7.086m0 0L21 21" />
    `,
	join_room: `
        <svg viewBox="0 0 26 27" fill="none" stroke="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 6C0 2.68629 2.68629 0 6 0H20C23.3137 0 26 2.68629 26 6V21C26 24.3137 23.3137 27 20 27H6C2.68629 27 0 24.3137 0 21V6Z" fill="#00ADEE"/>
        <rect x="13" y="7" width="1" height="13" rx="0.5" fill="white"/>
        <rect x="20" y="13" width="1" height="13" rx="0.5" transform="rotate(90 20 13)" fill="white"/>
        </svg>
    `,
	promote: `
        <svg class="h-8 w-8"  fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/>
        </svg>
   `,
	exclamation: `
        <svg class="h-8 w-8"  fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
  `,

	actionmenu: `
        <svg viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
        </svg>
    `,
	lock: `<svg width="17" height="23" viewBox="0 0 17 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect y="7.51758" width="16.2963" height="15.4815" rx="1" fill="#001242"/>
        <circle cx="8.14916" cy="14.0378" r="1.62963" fill="white"/>
        <rect x="7.33398" y="14.8516" width="1.62963" height="4.07407" rx="0.638889" fill="white"/>
        <path d="M2.85156 7.51852C2.85156 5.07407 3.5849 1 8.14786 1C12.7108 1 13.4439 5.07407 13.4439 7.51852" stroke="#001242" stroke-width="2"/>
        </svg>`,
	slash: `<svg class="h-10 w-10 text-gray-500"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round">  <circle cx="12" cy="12" r="10" />  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>`,
	help: `<svg class="h-10 w-10 text-gray-500"  width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">  <path stroke="none" d="M0 0h24v24H0z"/>  <circle cx="12" cy="12" r="9" />  <line x1="12" y1="17" x2="12" y2="17.01" />  <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" /></svg>`,
	announcement: `<svg width="23" height="23" viewBox="0 0 23 23" fill="none" stroke="currentColor" stroke-width="0.3"  xmlns="http://www.w3.org/2000/svg">
        <path d="M20.0416 0.800781H2.76156C1.57356 0.800781 0.612362 1.77278 0.612362 2.96078L0.601562 22.4008L4.92156 18.0808H20.0416C21.2296 18.0808 22.2016 17.1088 22.2016 15.9208V2.96078C22.2016 1.77278 21.2296 0.800781 20.0416 0.800781ZM12.4816 10.5208H10.3216V4.04078H12.4816V10.5208ZM12.4816 14.8408H10.3216V12.6808H12.4816V14.8408Z" fill="white"/>
        </svg>`,
	power_level: `<svg width="9" height="11" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4.5" cy="2.5" r="2.5" fill="white"/>
        <path d="M0 7.5C0 6.11929 1.11929 5 2.5 5H6.5C7.88071 5 9 6.11929 9 7.5V10H0V7.5Z" fill="white"/>
        </svg>
        `,
	directmsg: `<svg width="24" height="24" viewBox="-0.5 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.985 5.58834C13.2151 8.8924 10.6791 11.7582 7.32282 11.9847C5.52212 12.1078 3.84648 11.4431 2.65102 10.2958L0 10.4632L1.53559 8.84808C1.13043 8.11932 0.880339 7.29207 0.815314 6.41066C0.590227 3.1066 3.1262 0.24078 6.48249 0.0142721C9.83878 -0.212236 12.7499 2.28428 12.98 5.58834H12.985Z" fill="currentColor"/>
                </svg>
        `,
	image_add: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.3408 7.6582C13.1692 7.6582 13.8408 6.98663 13.8408 6.1582C13.8408 5.32978 13.1692 4.6582 12.3408 4.6582C11.5124 4.6582 10.8408 5.32978 10.8408 6.1582C10.8408 6.98663 11.5124 7.6582 12.3408 7.6582Z" fill="#202020"/>
        <path d="M17 8.23047V4.75C17 3.88805 16.6573 3.06164 16.0479 2.45215C15.4384 1.84266 14.612 1.5 13.75 1.5H4.75C3.88805 1.5 3.06164 1.84266 2.45215 2.45215C1.84266 3.06164 1.5 3.88805 1.5 4.75V11.7695L3.55859 9.31152H3.55957C3.81763 9.00356 4.13983 8.75589 4.50391 8.58594C4.86808 8.41596 5.2651 8.32715 5.66699 8.32715C6.06889 8.32715 6.4659 8.41596 6.83008 8.58594C7.19416 8.75589 7.51635 9.00356 7.77441 9.31152L9.0166 10.793C9.28261 11.1104 9.24115 11.5835 8.92383 11.8496C8.6262 12.099 8.1913 12.0787 7.91895 11.8135L7.86719 11.7568L6.625 10.2744C6.50771 10.1345 6.36076 10.0216 6.19531 9.94434C6.02991 9.86722 5.8495 9.82715 5.66699 9.82715C5.48448 9.82715 5.30408 9.86722 5.13867 9.94434C4.97322 10.0216 4.82628 10.1345 4.70898 10.2744L1.5166 14.084C1.59401 14.8335 1.93009 15.5362 2.47168 16.0684C3.07956 16.6656 3.89783 17.0001 4.75 17H8.23047L8.30664 17.0039C8.68485 17.0423 8.98047 17.3617 8.98047 17.75C8.98047 18.1383 8.68485 18.4577 8.30664 18.4961L8.23047 18.5H4.75C3.50453 18.5002 2.30834 18.0115 1.41992 17.1387C0.531505 16.2658 0.021796 15.0783 0 13.833V4.75C0 3.49022 0.500804 2.2824 1.3916 1.3916C2.2824 0.500804 3.49022 0 4.75 0H13.75C15.0098 0 16.2176 0.500804 17.1084 1.3916C17.9992 2.2824 18.5 3.49022 18.5 4.75V8.23047C18.4997 8.64447 18.1641 8.98047 17.75 8.98047C17.3359 8.98047 17.0003 8.64447 17 8.23047Z" fill="#202020"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M14.75 20.25C16.2087 20.25 17.6076 19.6705 18.6391 18.6391C19.6705 17.6076 20.25 16.2087 20.25 14.75C20.25 13.2913 19.6705 11.8924 18.6391 10.8609C17.6076 9.82946 16.2087 9.25 14.75 9.25C13.2913 9.25 11.8924 9.82946 10.8609 10.8609C9.82946 11.8924 9.25 13.2913 9.25 14.75C9.25 16.2087 9.82946 17.6076 10.8609 18.6391C11.8924 19.6705 13.2913 20.25 14.75 20.25ZM14.75 11.257C14.8826 11.257 15.0098 11.3097 15.1036 11.4034C15.1973 11.4972 15.25 11.6244 15.25 11.757V14.25H17.743C17.8756 14.25 18.0028 14.3027 18.0966 14.3964C18.1903 14.4902 18.243 14.6174 18.243 14.75C18.243 14.8826 18.1903 15.0098 18.0966 15.1036C18.0028 15.1973 17.8756 15.25 17.743 15.25H15.25V17.744C15.25 17.8766 15.1973 18.0038 15.1036 18.0976C15.0098 18.1913 14.8826 18.244 14.75 18.244C14.6174 18.244 14.4902 18.1913 14.3964 18.0976C14.3027 18.0038 14.25 17.8766 14.25 17.744V15.25H11.757C11.6244 15.25 11.4972 15.1973 11.4034 15.1036C11.3097 15.0098 11.257 14.8826 11.257 14.75C11.257 14.6174 11.3097 14.4902 11.4034 14.3964C11.4972 14.3027 11.6244 14.25 11.757 14.25H14.25V11.757C14.25 11.6244 14.3027 11.4972 14.3964 11.4034C14.4902 11.3097 14.6174 11.257 14.75 11.257Z"/>
        </svg>
        `,
	user: `<svg width="24" height="24" viewBox="0 -1 7 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="2" r="2" fill="currentColor"/><path d="M4 5C1.2202 5 0.332798 6.62205 0.0852951 8.00531C-0.0119791 8.54896 0.447715 9 1 9H7C7.55228 9 8.01198 8.54896 7.91471 8.00531C7.6672 6.62205 6.7798 5 4 5Z" fill="currentColor"/></svg>`,
	clock: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>`,
	lock_closed: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z"/></svg>`,
	lock_open: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M480-280q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q75 0 130.5 48.5T917-752q2 13-9 22.5t-28 9.5q-17 0-28-7t-16-23q-11-38-42.5-64T720-840q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z"/></svg>`,
	share: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6.616 22q-.691 0-1.153-.462T5 20.385v-9.77q0-.69.463-1.152T6.616 9H8.73v1H6.616q-.231 0-.424.192T6 10.616v9.769q0 .23.192.423t.423.192h10.77q.23 0 .423-.192t.192-.423v-9.77q0-.23-.192-.423T17.384 10H15.27V9h2.115q.691 0 1.153.463T19 10.616v9.769q0 .69-.463 1.153T17.385 22zm4.884-6.5V4.614l-2.1 2.1L8.692 6L12 2.692L15.308 6l-.708.714l-2.1-2.1V15.5z"/></svg>`,
	back: `<svg class="h-24 w-24"  fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>`,
	admin_contact: `<svg fill="currentColor" height="24" width="24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  viewBox="0 0 24 24" enable-background="new 0 0 24 24" xml:space="preserve"> <g id="user-admin"><path d="M22.3,16.7l1.4-1.4L20,11.6l-5.8,5.8c-0.5-0.3-1.1-0.4-1.7-0.4C10.6,17,9,18.6,9,20.5s1.6,3.5,3.5,3.5s3.5-1.6,3.5-3.5 c0-0.6-0.2-1.2-0.4-1.7l1.9-1.9l2.3,2.3l1.4-1.4l-2.3-2.3l1.1-1.1L22.3,16.7z M12.5,22c-0.8,0-1.5-0.7-1.5-1.5s0.7-1.5,1.5-1.5 s1.5,0.7,1.5,1.5S13.3,22,12.5,22z"/><path d="M2,19c0-3.9,3.1-7,7-7c2,0,3.9,0.9,5.3,2.4l1.5-1.3c-0.9-1-1.9-1.8-3.1-2.3C14.1,9.7,15,7.9,15,6c0-3.3-2.7-6-6-6 S3,2.7,3,6c0,1.9,0.9,3.7,2.4,4.8C2.2,12.2,0,15.3,0,19v5h8v-2H2V19z M5,6c0-2.2,1.8-4,4-4s4,1.8,4,4s-1.8,4-4,4S5,8.2,5,6z"/></g></svg>`,
	envelope: `<svg width="24" height="24" viewBox="0 0 16 12"  stroke="none" fill="currentColor"  xmlns="http://www.w3.org/2000/svg"> <path  d="M1.5 0C0.671875 0 0 0.671875 0 1.5C0 1.97187 0.221875 2.41562 0.6 2.7L7.4 7.8C7.75625 8.06563 8.24375 8.06563 8.6 7.8L15.4 2.7C15.7781 2.41562 16 1.97187 16 1.5C16 0.671875 15.3281 0 14.5 0H1.5ZM0 3.5V10C0 11.1031 0.896875 12 2 12H14C15.1031 12 16 11.1031 16 10V3.5L9.2 8.6C8.85401 8.86013 8.43287 9.00078 8 9.00078C7.56713 9.00078 7.14599 8.86013 6.8 8.6L0 3.5Z"  /></svg>`,
	swap: '<svg class="h-24 w-24"  fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke="none" d="M0 0h24v24H0z"/>  <circle cx="5" cy="18" r="2" />  <circle cx="19" cy="6" r="2" />  <path d="M19 8v5a5 5 0 0 1 -5 5h-3l3 -3m0 6l-3 -3" />  <path d="M5 16v-5a5 5 0 0 1 5 -5h3l-3 -3m0 6l3 -3" /></svg>',
	bell: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160ZM480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80Z"/></svg>',
};

export { icons, phicons, PHiconSizes, iconSizes as sizes };
