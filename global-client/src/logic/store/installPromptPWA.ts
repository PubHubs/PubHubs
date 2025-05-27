import { defineStore } from 'pinia';
import device from '@/../../hub-client/src/logic/core/device';

export interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{
		outcome: 'accepted' | 'dismissed';
		platform: string;
	}>;
	prompt(): Promise<void>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
}

type InstallPromptState = {
	neverShowAgain: boolean;
	showPrompt: boolean;
	deferredPrompt: undefined | BeforeInstallPromptEvent;
};

export const useInstallPromptStore = defineStore('installPrompt', {
	state: (): InstallPromptState => ({
		neverShowAgain: false,
		showPrompt: false,
		deferredPrompt: undefined,
	}),

	getters: {
		conditionsMet() {
			return device.getMobileOS() !== 'Unknown' && device.getBrowserName() !== 'Unknown' && !device.isRunningStandalone();
		},
	},

	actions: {
		setDeferredPrompt(prompt: BeforeInstallPromptEvent) {
			this.deferredPrompt = prompt;
		},
		resetDeferredPrompt() {
			this.deferredPrompt = undefined;
		},

		setNeverShowAgain(value: boolean) {
			this.neverShowAgain = value;
			localStorage.setItem('neverShowInstallPrompt', String(value));
		},

		loadNeverShowAgain() {
			const savedPreference = localStorage.getItem('neverShowInstallPrompt');
			if (savedPreference !== null) {
				this.neverShowAgain = savedPreference === 'true';
			}
		},

		setShowPrompt(value: boolean) {
			this.showPrompt = value;
		},

		checkConditionsAndSetPrompt() {
			this.setShowPrompt(this.conditionsMet && !this.neverShowAgain);
		},
	},
});
