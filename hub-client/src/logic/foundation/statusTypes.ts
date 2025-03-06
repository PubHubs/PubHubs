export enum LogLevel {
	Trace = 0,
	Info = 10,
	Warn = 20,
	Error = 30,
	Fatal = 40,
	// Used as a default value that always logs
	Silent = 50,
}

export type SecuredRoomAttributeResult = {
	goto: string;
	not_correct: string;
};
