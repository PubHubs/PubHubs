import { resolve } from 'path';

const r = (p: string) => resolve(__dirname, p);

export const alias: Record<string, string> = {
	'@': r('./src'),
};
