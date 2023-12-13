import { defineStore } from 'pinia';
import { useMessageBox, Message, MessageType } from '@/store/store';


const useToggleMenu = defineStore('toggleMenu', {
	
	actions: {
		toggleGlobalMenu() {
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.mobileHubMenu));
		},
	},
});

export { useToggleMenu };
