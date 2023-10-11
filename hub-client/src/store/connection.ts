import { defineStore } from 'pinia';

enum ConnectionState {
	On = 'ON',
	Off = 'OFF',
	Error = 'ERROR',
}

const useConnection = defineStore('connection', {
	state: () => {
		return {
			internet: ConnectionState.Off,
		};
	},

	getters: {
		isOn: (state): boolean => {
			return state.internet == ConnectionState.On;
		},
	},

	actions: {
		on() {
			this.internet = ConnectionState.On;
		},
		off() {
			this.internet = ConnectionState.Off;
		},
		error() {
			this.internet = ConnectionState.Error;
		},
	},
});

export { ConnectionState, useConnection };
