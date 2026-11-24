// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Composables
import { useBackNavigation } from '@hub-client/composables/useBackNavigation';
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRouter: () => ({ currentRoute: { value: { name: 'room', params: { id: 'room' } } }, push: vi.fn() }),
}));

describe('useBackNavigation', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useSidebar().close();
	});

	test('back closes an open file before the sidebar', () => {
		const sidebar = useSidebar();
		const { back } = useBackNavigation();
		sidebar.openTab(SidebarTab.Library);
		sidebar.selectedLibraryFileId.value = '$file';

		back();
		expect(sidebar.selectedLibraryFileId.value).toBeNull();
		expect(sidebar.activeTab.value).toBe(SidebarTab.Library);

		back();
		expect(sidebar.isOpen.value).toBe(false);
	});

	test('back closes an open member profile before the sidebar', () => {
		const sidebar = useSidebar();
		const { back } = useBackNavigation();
		sidebar.openMemberProfile('@member:hub');

		back();
		expect(sidebar.selectedMemberId.value).toBeNull();
		expect(sidebar.activeTab.value).toBe(SidebarTab.Members);

		back();
		expect(sidebar.isOpen.value).toBe(false);
	});

	test('switching tabs forgets the open file', () => {
		const sidebar = useSidebar();
		sidebar.openTab(SidebarTab.Library);
		sidebar.selectedLibraryFileId.value = '$file';

		sidebar.openTab(SidebarTab.Members);
		expect(sidebar.selectedLibraryFileId.value).toBeNull();
	});
});
