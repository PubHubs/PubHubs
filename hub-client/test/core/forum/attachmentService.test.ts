import * as fileUploadModule from '@hub-client/composables/fileUpload';

import { EventType, MsgType } from 'matrix-js-sdk';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { AttachmentService } from '@hub-client/services/forum/AttachmentService';
import type { TimelineWindow } from 'matrix-js-sdk';
import { useForumStore } from '@hub-client/stores/forum/forumStore';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

beforeAll(() => {
	vi.stubEnv('PUBHUBS_URL', 'http://localhost');
});

describe('AttachmentService', () => {
	let attachmentService: AttachmentService;
	let forumStore: ReturnType<typeof useForumStore>;
	let timelineStore: ReturnType<typeof useTimelineStore>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.spyOn(usePubhubsStore().Auth, 'getAccessToken').mockReturnValue('dummy-token');

		forumStore = useForumStore();
		timelineStore = useTimelineStore();

		forumStore.forumTopics = [{ eventId: 'parent1', title: '', body: '', closed: false, author: null, timestamp: 0, likes: 0, dislikes: 0, replies: [], image: undefined, file: undefined }];
		forumStore.buildThreadIndex();

		const fakeEvents = [
			{
				getContent: () => ({
					msgtype: MsgType.Image,
					url: 'http://img',
					info: { mimetype: 'image/png', size: 100 },
					'm.relates_to': { 'm.in_reply_to': { event_id: 'parent1' } },
				}),
				event: { event_id: 'imgEvt1' },
			},
			{
				getContent: () => ({
					msgtype: MsgType.File,
					filename: 'file.txt',
					url: 'http://file',
					info: { mimetype: 'text/plain', size: 200 },
					'm.relates_to': { 'm.in_reply_to': { event_id: 'parent1' } },
				}),
				event: { event_id: 'fileEvt1' },
			},
		];
		timelineStore.tw = { getEvents: () => fakeEvents } as TimelineWindow;

		attachmentService = new AttachmentService({ sendEvent: vi.fn() } as any, { roomId: 'r1' } as any);
	});

	test('loadAttachments attaches image and file to the matching thread', () => {
		attachmentService.loadAttachments();
		const thread = forumStore.forumTopics[0];

		expect(thread.image).toMatchObject({
			event_id: 'imgEvt1',
			content: expect.objectContaining({ url: 'http://img' }),
			type: EventType.RoomMessage,
		});
		expect(thread.file).toMatchObject({
			event_id: 'fileEvt1',
			content: expect.objectContaining({ url: 'http://file', filename: 'file.txt' }),
			type: EventType.RoomMessage,
		});
	});

	test('sendAttachment uploads and sends a file event', async () => {
		vi.spyOn(fileUploadModule, 'fileUpload').mockImplementation((_key, _token, _url, _types, _evt, cb: (url: string) => void) => cb('http://uploaded'));

		const sendEventSpy = vi.fn().mockResolvedValue({ event_id: 'SENT123' });
		attachmentService = new AttachmentService({ sendEvent: sendEventSpy } as any, { roomId: 'roomABC' } as any);

		const fakeLocal = { file: { name: 'foo', size: 10, type: 'text/plain' }, msgtype: MsgType.File } as any;
		const result = await attachmentService.sendAttachment(fakeLocal, 'parent1');

		expect(result).toEqual({ id: 'SENT123', url: 'http://uploaded' });
		expect(sendEventSpy).toHaveBeenCalledWith('roomABC', EventType.RoomMessage, expect.objectContaining({ 'm.relates_to': { 'm.in_reply_to': { event_id: 'parent1' } } }));
	});
});
