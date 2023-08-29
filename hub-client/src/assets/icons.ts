import { iconSizes } from './sizes';

/**
 * Every icon has a key and a svg code:
 *
 *  'key': `<svg code>....</svg>`
 *
 * Adding / changing icons here will reflect in all the UI and the histoire environment.
 *
 *
 * For icon sizes, see ./sizes.ts
 *
 *
 * Some icons are based on https://tailwindtoolbox.com/icons
 */

const icons: { [key: string]: string } = {
	empty: ``,
	home: `
        <path stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        `,
	circle: `
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        `,
	'pubhubs-home': `
        <circle cx="12" cy="12" r="9" fill="currentColor"/>
        <path d="M4.25306 12.2951L17.0548 0.626046L13.3499 17.5472L0.548216 29.2163L4.25306 12.2951Z" fill="black" stroke="black" stroke-linejoin="round" transform="scale(0.5) translate(15,9)"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
        `,
	close: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
        `,
	plus: `
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
        `,
	remove: `
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        `,
	edit: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <path d="M9 7 h-3a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-3" />
        <path d="M9 15h3l8.5 -8.5a1.5 1.5 0 0 0 -3 -3l-8.5 8.5v3" />
        <line x1="16" y1="5" x2="19" y2="8" />
        `,
	power: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <path d="M7 6a7.75 7.75 0 1 0 10 0" />
        <line x1="12" y1="4" x2="12" y2="12" />
        `,
	unlink: `
        <path d="M10 14a3.5 3.5 0 0 0 5 0l4 -4a3.5 3.5 0 0 0 -5 -5l-.5 .5" />
        <path d="M14 10a3.5 3.5 0 0 0 -5 0l-4 4a3.5 3.5 0 0 0 5 5l.5 -.5" />
        <line x1="16" y1="21" x2="16" y2="19" />
        <line x1="19" y1="16" x2="21" y2="16" />
        <line x1="3" y1="8" x2="5" y2="8" />
        <line x1="8" y1="3" x2="8" y2="5" />
        `,
	talk: `
        <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <path d="M21.641789,13.3147778 C22.0252911,18.8215755 17.7986006,23.5980192 12.204769,23.9755213 C9.20358535,24.1806892 6.41083623,23.0726829 4.41839164,21.1605054 L0,21.439507 L2.55933113,18.7477085 C1.88406065,17.5331016 1.46723996,16.1543438 1.35886435,14.6853188 C0.983717226,9.17852105 5.21036278,4.40212572 10.8042111,4.02461092 C16.3980593,3.64709478 21.2499534,7.80797997 21.6334556,13.3147778 L21.641789,13.3147778 Z" id="Path" fill="currentColor"></path>
        </g>
        `,
	room: `
        <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="Vector" transform="translate(0.000000, 1.00000)">
            <path d="M21.641789,12.3147778 C22.0252911,17.8215755 17.7986006,22.5980192 12.204769,22.9755213 C9.20358535,23.1806892 6.41083623,22.0726829 4.41839164,20.1605054 L0,20.439507 L2.55933113,17.7477085 C1.88406065,16.5331016 1.46723996,15.1543438 1.35886435,13.6853188 C0.983717226,8.17852105 5.21036278,3.40212572 10.8042111,3.02461092 C16.3980593,2.64709478 21.2499534,6.80797997 21.6334556,12.3147778 L21.641789,12.3147778 Z" id="Path" fill="currentColor"></path>
            <path d="M4.0230087,9.31440598 C3.6690247,14.8212063 7.57054351,19.5975687 12.7341084,19.975071 C15.5044086,20.180239 18.082341,19.0723989 19.9215355,17.1602205 L24.0000438,17.4392222 L21.6375293,14.7473558 C22.2608665,13.5327317 22.6457022,12.15399 22.7457028,10.6849643 C23.0920382,5.17814741 19.1904644,0.401759933 14.0269162,0.0242446296 C8.86336806,-0.353271341 4.3846874,3.80760572 4.03070341,9.31440598 L4.0230087,9.31440598 Z" id="Path" stroke="currentColor" fill="#FFFFFF"></path>
        </g>
        </g>
        `,
	search: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <circle cx="10" cy="10" r="7" />
        <line x1="21" y1="21" x2="15" y2="15" />
        `,
	emoticon: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        `,
	paperclip: `
        <path stroke="none" d="M0 0h24v24H0z"/>
        <path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9 l6.5 -6.5" />
        `,
	lock: `
        <path d="M15.1176 4.48959L8.17454 1L1 4.48959C2.15718 9.2003 4.93443 16.0733 8.17454 17C11.6461 15.8416 14.269 9.2003 15.1176 4.48959Z" stroke-linejoin="round"/>
        `,
	'arrow-right': `
        <path stroke="none" d="M0 0h24v24H0z"/>  <line x1="5" y1="12" x2="19" y2="12" />  <line x1="15" y1="16" x2="19" y2="12" />  <line x1="15" y1="8" x2="19" y2="12" />
        `,
	admin: `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"/>
    `,
};

export { icons, iconSizes as sizes };