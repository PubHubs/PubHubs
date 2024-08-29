import { defineStore } from 'pinia';
import { useMessageBox, Message, MessageType } from '@/store/store';

const useToggleMenu = defineStore('toggleMenu', {
	state: () => {
		return {
			globalIsActive: false,
		};
	},
	actions: {
		toggleMenuAndSendToHub() {
			const messageBox = useMessageBox();
			this.globalIsActive = !this.globalIsActive;
			messageBox.sendMessage(new Message(this.globalIsActive ? MessageType.BarShow : MessageType.BarHide));
		},
		showMenuAndSendToHub() {
			const messageBox = useMessageBox();
			this.globalIsActive = true;
			messageBox.sendMessage(new Message(MessageType.BarShow, this.globalIsActive));
		},
		hideMenuAndSendToHub() {
			const messageBox = useMessageBox();
			this.globalIsActive = false;
			messageBox.sendMessage(new Message(MessageType.BarHide, this.globalIsActive));
		},
	},
});

export { useToggleMenu };
