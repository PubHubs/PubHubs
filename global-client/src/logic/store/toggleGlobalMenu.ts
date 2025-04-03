// Project imports
import { defineStore } from 'pinia';

// Global imports
import { useMessageBox, Message, MessageType, iframeHubId } from '@/logic/store/messagebox';

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
			messageBox.sendMessage(new Message(this.globalIsActive ? MessageType.BarShow : MessageType.BarHide), iframeHubId);
		},
		showMenuAndSendToHub() {
			const messageBox = useMessageBox();
			this.globalIsActive = true;
			messageBox.sendMessage(new Message(MessageType.BarShow, this.globalIsActive), iframeHubId);
		},
		hideMenuAndSendToHub() {
			const messageBox = useMessageBox();
			this.globalIsActive = false;
			messageBox.sendMessage(new Message(MessageType.BarHide, this.globalIsActive), iframeHubId);
		},
	},
});

export { useToggleMenu };
