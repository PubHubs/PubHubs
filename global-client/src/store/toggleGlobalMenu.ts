import { defineStore } from 'pinia';
import { useMessageBox, Message, MessageType } from '@/store/store';

const useToggleMenu = defineStore('toggleMenu', {
	state: () => {
		return {
			globalIsActive: false,
		};
	},
	actions: {
		toggleMenu() {
			const messageBox = useMessageBox();
			this.globalIsActive = !this.globalIsActive;
			messageBox.sendMessage(new Message(MessageType.mobileHubMenu, this.globalIsActive));
		},
	},
});

export { useToggleMenu };
