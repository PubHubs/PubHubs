import { Filter, MatrixClient, TimelineWindow } from 'matrix-js-sdk';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { Room as MatrixRoom } from 'matrix-js-sdk/lib/models/room';
import { useTimelineStore } from '@hub-client/stores/forum/timelineStore';

// Mock dependencies
vi.mock('@hub-client/stores/rooms', () => ({
	useRooms: vi.fn(() => ({
		currentRoom: {
			roomId: 'test-room-id',
		},
	})),
}));

vi.mock('@hub-client/stores/pubhubsStore', () => ({
	usePubHubs: vi.fn(() => ({
		client: {
			getRoom: vi.fn(),
		},
	})),
}));

vi.mock('matrix-js-sdk', async () => {
	const actual = await vi.importActual('matrix-js-sdk');
	return {
		...actual,
		TimelineWindow: vi.fn(),
		Filter: vi.fn(class {
			setDefinition =  vi.fn(()=>{});
		}),
	};
});

describe('timelineStore', () => {
	let timelineStore: ReturnType<typeof useTimelineStore>;
	let mockMatrixRoom: MatrixRoom;
	let mockClient: MatrixClient;

	beforeEach(() => {
		setActivePinia(createPinia());
		timelineStore = useTimelineStore();

		mockMatrixRoom = {
			getTimelineSets: vi.fn().mockReturnValue([]),
			removeFilteredTimelineSet: vi.fn(),
			getOrCreateFilteredTimelineSet: vi.fn(),
		} as unknown as MatrixRoom;

		mockClient = {
			getRoom: vi.fn().mockReturnValue(mockMatrixRoom),
		} as unknown as MatrixClient;

		timelineStore.client = mockClient;

		vi.mocked(Filter).mockClear();
		vi.mocked(TimelineWindow).mockClear();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	test('initRoom sets up room correctly', () => {
		timelineStore.initRoom();

		expect(timelineStore.room).toBeDefined();
		expect(timelineStore.room?.roomId).toBe('test-room-id');
		expect(timelineStore.matrixRoom?.roomId).toBe(mockMatrixRoom.roomId);
		expect(mockClient.getRoom).toHaveBeenCalledWith('test-room-id');
	});

	test('initRoom throws error when no room found', () => {
		vi.mocked(mockClient.getRoom).mockReturnValueOnce(null);

		expect(() => timelineStore.initRoom()).toThrow('No room found');
	});

	test('createFilteredTimelineWindow removes multiple old filtered timeline sets', () => {
		const oldFilter1 = { id: 'old-filter-1' };
		const oldFilter2 = { id: 'old-filter-2' };

		vi.mocked(mockMatrixRoom.getTimelineSets).mockReturnValueOnce([{ getFilter: () => oldFilter1 } as any, { getFilter: () => oldFilter2 } as any]);

		timelineStore.matrixRoom = mockMatrixRoom;
		const filterDefinition = { definition: 'test' };
		timelineStore.createFilteredTimelineWindow(filterDefinition);

		expect(mockMatrixRoom.removeFilteredTimelineSet).toHaveBeenCalledWith(oldFilter1);
		expect(mockMatrixRoom.removeFilteredTimelineSet).toHaveBeenCalledWith(oldFilter2);
		expect(mockMatrixRoom.removeFilteredTimelineSet).toHaveBeenCalledTimes(2);
	});

	test('createFilteredTimelineWindow ignores timeline sets without filters', () => {
		vi.mocked(mockMatrixRoom.getTimelineSets).mockReturnValueOnce([{ getFilter: () => null } as any, { getFilter: () => undefined } as any]);

		timelineStore.matrixRoom = mockMatrixRoom;
		timelineStore.createFilteredTimelineWindow({ definition: 'test' });

		expect(mockMatrixRoom.removeFilteredTimelineSet).not.toHaveBeenCalled();
	});

	test('createFilteredTimelineWindow does nothing with no filter definition', () => {
		timelineStore.matrixRoom = mockMatrixRoom;
		timelineStore.createFilteredTimelineWindow(null);

		expect(Filter).not.toHaveBeenCalled();
		expect(TimelineWindow).not.toHaveBeenCalled();
	});
});
