// Packages
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import RoomLibrary from '@hub-client/components/rooms/RoomLibrary.vue';

// Composables
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

// Locales
import { en } from '@hub-client/locales/en';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { yiviFlow } from '@hub-client/logic/yiviHandler';

// Stores
import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
import { useDialog } from '@hub-client/stores/dialog';

const roomLibrary = vi.hoisted(() => ({
	makeHash: vi.fn(),
	deleteMedia: vi.fn(),
	removeFromTimeline: vi.fn(),
}));
const roles = vi.hoisted(() => ({ isSteward: false }));

vi.mock('@hub-client/composables/useRoomLibrary', () => ({ useRoomLibrary: () => roomLibrary }));
vi.mock('@hub-client/composables/roles.composable', () => ({ useRoles: () => ({ userIsStewardOrHigher: () => roles.isSteward }) }));
vi.mock('@hub-client/composables/useMatrixFiles', () => ({
	useMatrixFiles: () => ({
		uploadUrl: 'https://hub/upload',
		formUrlfromMxc: (mxc: string) => `https://hub/download/${mxc.slice(6)}`,
		deleteMediaUrlfromMxc: (mxc: string) => `https://hub/delete/${mxc.slice(6)}`,
		isImage: () => false,
	}),
}));
vi.mock('@hub-client/composables/useTimeFormat', () => ({
	useTimeFormat: () => ({ formatTimestamp: () => '12:00', formattedTimeInformation: () => 'Today' }),
}));
vi.mock('@hub-client/logic/yiviHandler', () => ({ yiviFlow: vi.fn() }));
vi.mock('@hub-client/stores/pubhubs', () => ({ usePubhubsStore: () => ({ Auth: { getAccessToken: () => 'token' }, addSignedFile: vi.fn() }) }));
vi.mock('@hub-client/stores/user', () => ({
	useUser: () => ({
		userId: '@me:hub',
		userDisplayName: (userId: string) => ({ '@alice:hub': 'Alice', '@bob:hub': 'Bob', '@me:hub': 'Me' })[userId],
	}),
}));

type FileSpec = { id: string; filename: string; sender: string; ts: number; size?: number; msgtype?: string; relatesTo?: string };

// Minimal TimelineEvent stub
const libraryEvent = ({ id, filename, sender, ts, size = 1024, msgtype = 'm.file', relatesTo }: FileSpec) => {
	const content = relatesTo
		? {
				msgtype: PubHubsMgType.SignedFileMessage,
				'm.relates_to': { event_id: relatesTo },
				signed_message: { disclosed: [[{ id: 'pbdf.sidn-pbdf.email.email', rawvalue: `${sender.slice(1, sender.indexOf(':'))}@example.com` }]] },
			}
		: { msgtype, filename, body: filename, url: `mxc://hub/${id}`, info: { size } };
	return {
		isDeleted: false,
		matrixEvent: {
			event: { event_id: id, sender, content },
			getId: () => id,
			getSender: () => sender,
			getTs: () => ts,
			getContent: () => content,
		},
	};
};

const makeRoom = (initialEvents: ReturnType<typeof libraryEvent>[]) => {
	const events = [...initialEvents];
	return {
		roomId: '!room:hub',
		name: 'Room',
		initFileLibrary: vi.fn().mockResolvedValue(undefined),
		getLibraryTimeline: () => events,
		removeLibraryEvent: vi.fn((eventId: string) => {
			const index = events.findIndex((event) => event.matrixEvent.getId() === eventId);
			if (index !== -1) events.splice(index, 1);
		}),
	};
};

const defaultFiles = [
	libraryEvent({ id: '$old', filename: 'old.pdf', sender: '@alice:hub', ts: 1000 }),
	libraryEvent({ id: '$new', filename: 'new.pdf', sender: '@bob:hub', ts: 3000 }),
	libraryEvent({ id: '$mid', filename: 'mid.pdf', sender: '@me:hub', ts: 2000 }),
];

enableAutoUnmount(afterEach);

describe('RoomLibrary.vue', () => {
	const i18n = createI18n({ legacy: false, locale: 'en', warnHtmlMessage: false, messages: { en } });

	const mountLibrary = async (events = defaultFiles) => {
		const wrapper = mount(RoomLibrary, {
			props: { room: makeRoom(events) as never },
			global: {
				plugins: [i18n],
				directives: { contextMenu: {} },
				stubs: { Dialog: { props: ['title'], template: '<div class="dialog">{{ title }}<slot /></div>' } },
			},
			attachTo: document.body,
		});
		await flushPromises();
		return wrapper;
	};

	const rowNames = (wrapper: Awaited<ReturnType<typeof mountLibrary>>) =>
		wrapper.findAll('[data-testid="filemanager"] li').map((row) => row.find('button span span').text());

	beforeEach(() => {
		setActivePinia(createPinia());
		roles.isSteward = false;
		// Like the real one: a successful redaction takes the file out of the library
		roomLibrary.removeFromTimeline.mockImplementation(async (room: ReturnType<typeof makeRoom>, eventId: string) => {
			room.removeLibraryEvent(eventId);
			return true;
		});
		const sidebar = useSidebar();
		sidebar.openTab(SidebarTab.Library);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test('an empty library shows the empty state', async () => {
		const wrapper = await mountLibrary([]);
		expect(wrapper.find('[data-testid="filemanager-empty"]').text()).toContain(en.roomlibrary.empty);
		expect(wrapper.find('[data-testid="filemanager-footer"]').text()).toContain('0 files (max. 100)');
	});

	test('lists files by name with uploader, size and date', async () => {
		const wrapper = await mountLibrary();
		expect(rowNames(wrapper)).toEqual(['mid.pdf', 'new.pdf', 'old.pdf']);
		expect(wrapper.find('[data-testid="filemanager"] li').text()).toContain('Me · 1 KB · Today');
	});

	test('shows the sort order and reorders when another is picked', async () => {
		const wrapper = await mountLibrary();
		const sort = wrapper.find('[data-testid="library-sort"]');
		expect(sort.text()).toBe(en.roomlibrary.sort.name_asc);

		await sort.trigger('click');
		const menu = useContextMenuStore();
		menu.select(menu.items.find((item) => item.label === en.roomlibrary.sort.newest)!);
		await flushPromises();

		expect(rowNames(wrapper)).toEqual(['new.pdf', 'mid.pdf', 'old.pdf']);
		expect(wrapper.find('[data-testid="library-sort"]').text()).toBe(en.roomlibrary.sort.newest);
	});

	test('hides the sort control with a single file', async () => {
		const wrapper = await mountLibrary([defaultFiles[0]]);
		expect(wrapper.find('[data-testid="library-sort"]').exists()).toBe(false);
	});

	test('marks the list busy while loading', async () => {
		const room = makeRoom([]);
		// Never resolves
		room.initFileLibrary.mockReturnValue(new Promise(() => {}));
		const wrapper = mount(RoomLibrary, {
			props: { room: room as never },
			global: { plugins: [i18n], directives: { contextMenu: {} } },
		});
		await flushPromises();

		expect(wrapper.find('[data-testid="filemanager-list"]').attributes('aria-busy')).toBe('true');
		expect(wrapper.find('[data-testid="filemanager-list"] [role="status"]').text()).toBe(en.common.loading);
		expect(wrapper.find('[data-testid="filemanager-loading"]').attributes('aria-hidden')).toBe('true');
	});

	test('a search without matches says so', async () => {
		const wrapper = await mountLibrary();
		await wrapper.find('input[role="searchbox"]').setValue('nothing like this');
		expect(wrapper.find('[data-testid="filemanager"]').exists()).toBe(false);
		expect(wrapper.text()).toContain(en.others.search_nothing_found);
	});

	test('clicking a file opens its details, and back returns to the list', async () => {
		const wrapper = await mountLibrary();
		await wrapper.findAll('[data-testid="filemanager"] li')[0].find('button').trigger('click');

		expect(useSidebar().selectedLibraryFileId.value).toBe('$mid');
		expect(wrapper.text()).toContain(en.roomlibrary.file_details);
		expect(wrapper.text()).toContain('PDF');

		await wrapper.find('button.border-y-2').trigger('click');
		expect(useSidebar().selectedLibraryFileId.value).toBeNull();
	});

	// Opens the details of the first file (mid.pdf, uploaded by the current user) and deletes it
	const deleteMidFile = async (wrapper: Awaited<ReturnType<typeof mountLibrary>>) => {
		await wrapper.findAll('[data-testid="filemanager"] li')[0].find('button').trigger('click');
		await wrapper
			.findAll('button')
			.find((button) => button.text() === en.roomlibrary.delete_file)!
			.trigger('click');
		await flushPromises();
	};

	test('deleting a file also deletes its media, and a refused media delete does not keep the file', async () => {
		vi.spyOn(useDialog(), 'okcancel').mockResolvedValue(true);
		const confirm = vi.spyOn(useDialog(), 'confirm').mockResolvedValue(true);
		roomLibrary.deleteMedia.mockRejectedValue(new Error('media server down'));

		const wrapper = await mountLibrary();
		await deleteMidFile(wrapper);

		expect(roomLibrary.deleteMedia).toHaveBeenCalledWith('https://hub/delete/hub/$mid', '$mid', '!room:hub');
		expect(rowNames(wrapper)).toEqual(['new.pdf', 'old.pdf']);
		expect(confirm).not.toHaveBeenCalled();
	});

	test('restores a file that could not be removed from the library and reports it', async () => {
		vi.spyOn(useDialog(), 'okcancel').mockResolvedValue(true);
		const confirm = vi.spyOn(useDialog(), 'confirm').mockResolvedValue(true);
		let finishRemoval: (removed: boolean) => void = () => {};
		roomLibrary.removeFromTimeline.mockReturnValue(new Promise((resolve) => (finishRemoval = resolve)));

		const wrapper = await mountLibrary();
		await deleteMidFile(wrapper);

		// Hidden while the delete runs
		expect(rowNames(wrapper)).toEqual(['new.pdf', 'old.pdf']);

		finishRemoval(false);
		await flushPromises();
		expect(rowNames(wrapper)).toEqual(['mid.pdf', 'new.pdf', 'old.pdf']);
		expect(confirm).toHaveBeenCalledWith(i18n.global.t('roomlibrary.delete.failed', ['mid.pdf']));
	});

	test('a file that cannot be hashed is not signed', async () => {
		const confirm = vi.spyOn(useDialog(), 'confirm').mockResolvedValue(true);
		roomLibrary.makeHash.mockResolvedValue('');

		const wrapper = await mountLibrary();
		await wrapper.findAll('[data-testid="filemanager"] li')[0].find('button').trigger('click');
		const signAction = wrapper.findAll('button').find((button) => button.text() === en.roomlibrary.sign_file)!;
		await signAction.trigger('click');
		await flushPromises();

		expect(yiviFlow).not.toHaveBeenCalled();
		expect(confirm).toHaveBeenCalledWith(i18n.global.t('roomlibrary.sign_error', ['mid.pdf']));
		expect(wrapper.find('.dialog').exists()).toBe(false);
	});

	test('signs with the email attribute and shows who signed', async () => {
		roomLibrary.makeHash.mockResolvedValue('abc123');

		const wrapper = await mountLibrary([...defaultFiles, libraryEvent({ id: '$sig', filename: '', sender: '@alice:hub', ts: 4000, relatesTo: '$old' })]);
		await wrapper.findAll('[data-testid="filemanager"] li')[0].find('button').trigger('click');
		await wrapper
			.findAll('button')
			.find((button) => button.text() === en.roomlibrary.sign_file)!
			.trigger('click');
		await flushPromises();

		expect(wrapper.find('.dialog').text()).toContain('abc123');
		expect(vi.mocked(yiviFlow).mock.calls[0][4]).toEqual(['pbdf.sidn-pbdf.email.email']);

		// The signed file offers no second signature
		useSidebar().selectedLibraryFileId.value = '$old';
		await flushPromises();
		expect(wrapper.findAll('button').some((button) => button.text() === en.roomlibrary.sign_file)).toBe(false);
		expect(wrapper.text()).toContain(en.roomlibrary.signed);
		expect(wrapper.find('[data-testid="filemanager"] li:last-child .sr-only').text()).toBe(en.roomlibrary.info.sign);
		expect(wrapper.find('[data-testid="library-signature"]').text()).toContain('alice@example.com');
	});

	test('only stewards can select, and select all only takes matching files', async () => {
		const wrapper = await mountLibrary();
		expect(wrapper.find('[data-testid="filemanager-select"]').exists()).toBe(false);

		roles.isSteward = true;
		const stewardWrapper = await mountLibrary();
		await stewardWrapper.find('[data-testid="filemanager-select"]').trigger('click');
		await stewardWrapper.find('input[role="searchbox"]').setValue('mid');
		await stewardWrapper.find('[data-testid="filemanager-footer"] [role="checkbox"]').trigger('click');

		expect(stewardWrapper.find('[data-testid="filemanager-footer"]').text()).toContain('1 file selected');
	});

	test('hides the upload button while selecting and disables it when the room is full', async () => {
		roles.isSteward = true;
		const wrapper = await mountLibrary();
		expect(wrapper.find('[data-testid="library-upload"]').attributes('disabled')).toBeUndefined();

		await wrapper.find('[data-testid="filemanager-select"]').trigger('click');
		expect(wrapper.find('[data-testid="library-upload"]').exists()).toBe(false);

		const full = Array.from({ length: 100 }, (_, i) => libraryEvent({ id: `$file${i}`, filename: `file ${i}.pdf`, sender: '@alice:hub', ts: i }));
		const fullWrapper = await mountLibrary(full);
		const upload = fullWrapper.find('[data-testid="library-upload"]');
		expect(upload.attributes('disabled')).toBeDefined();
		expect(upload.attributes('title')).toBe(i18n.global.t('roomlibrary.library_full', [100]));
	});
});
