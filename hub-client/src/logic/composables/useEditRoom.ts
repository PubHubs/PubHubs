// Logic
import { usePubHubs } from '@/logic/core/pubhubsStore';
import { SecuredRoomAttributes } from '@/model/rooms/TSecuredRoom';
import { useRooms } from '@/logic/store/rooms';
import { useYivi } from '@/logic/store/yivi';
import { TSecuredRoom } from '@/logic/store/store';

// Model
import { TEditRoom, TEditRoomFormAttributes } from '@/model/rooms/TEditRoom';
import { Attribute } from '@/model/yivi/TYivi';
import { RoomType } from '@/model/rooms/TBaseRoom';

function useEditRoom() {
	const pubhubsStore = usePubHubs();
	const roomsStore = useRooms();
	const yiviStore = useYivi();
	const emptyNewRoom = {
		name: '',
		topic: '',
		accepted: [],
		user_txt: '',
		type: '',
	} as TSecuredRoom;

	/**
	 * Updates or creates a public room with the given attributes.
	 */
	async function updatePublicRoom(isNewRoom: boolean, room: TEditRoom, room_id: string) {
		if (isNewRoom) {
			let newRoomOptions = {
				name: room.name,
				topic: room.topic,
				visibility: 'public',
				creation_content: {
					type: room.type === '' ? undefined : room.type,
				},
			};
			await pubhubsStore.createRoom(newRoomOptions);
		} else {
			await pubhubsStore.renameRoom(room_id, room.name!);
			await pubhubsStore.setTopic(room_id as string, room.topic!);
		}
	}
	/**
	 * Updates or creates a secured room with the given attributes.
	 */
	async function updateSecuredRoom(isNewRoom: boolean, room: TEditRoom, selectedAttributes: Array<TEditRoomFormAttributes>, attributeRemoved: boolean, room_id?: string) {
		let accepted = {} as SecuredRoomAttributes;

		for (const attribute of selectedAttributes) {
			accepted[attribute.attribute] = {
				accepted_values: attribute.accepted,
				profile: attribute.profile,
			};
		}
		room.accepted = accepted;
		room.type = RoomType.PH_MESSAGES_RESTRICTED;
		if (isNewRoom) {
			await roomsStore.addSecuredRoom(room);
		} else {
			await roomsStore.changeSecuredRoom(room);
			if (attributeRemoved && room_id) {
				roomsStore.kickUsersFromSecuredRoom(room_id);
			}
		}
	}
	/**
	 * Returns two values as a tuple: the found yivi labels and the yivi secured attribute keys.
	 */
	function getYiviLabelsAndAttributes(accepted: SecuredRoomAttributes, t: (key: string, ...args: any[]) => string): [string[], string[]] {
		const attributes = Object.keys(accepted);
		const yiviAttributes = yiviStore.getAttributes(t);
		const labels = attributes.map((attrKey) => {
			const found = yiviAttributes.find((attribute: Attribute) => attribute.attribute === attrKey);
			return found ? found.label : attrKey;
		});
		return [labels, attributes];
	}
	/**
	 * Translates the selected attributes from labels to yivi attributes.
	 * If a label is not found in the yivi attributes, it will set the attribute to the label itself.
	 */
	function translateYiviLabelsToAttributes(selectedAttributes: Array<TEditRoomFormAttributes>, t: (key: string, ...args: any[]) => string): Array<TEditRoomFormAttributes> {
		for (const item of selectedAttributes) {
			const found = yiviStore.getAttributes(t).find((attr: any) => attr.label === item.label);
			if (!found) item.attribute = item.label;
			else item.attribute = found.attribute;
		}
		return selectedAttributes;
	}
	/**
	 * Fills the edit form with the labels, attributes and accepted values.
	 * It will return an array of objects with label, attribute, accepted and profile.
	 */
	function fillInEditFormAttributes(labels: string[], attributes: string[], acceptedAttributes: SecuredRoomAttributes) {
		return labels.map((label: string, index: number) => {
			const attrKey = attributes[index];
			const acceptedObj = acceptedAttributes[attrKey];
			return {
				label,
				attribute: attrKey,
				accepted: acceptedObj ? acceptedObj.accepted_values : [],
				profile: acceptedObj ? acceptedObj.profile : false,
			};
		});
	}
	function attributesChanged(selectedAttributes: Array<TEditRoomFormAttributes>, OriginalAttributes: Array<TEditRoomFormAttributes>): string {
		if (selectedAttributes.length > OriginalAttributes.length) {
			return 'admin.remove_warning';
		}
		for (const [index, attribute] of OriginalAttributes.entries()) {
			if (!selectedAttributes[index] || !attribute.accepted.every((value: string) => selectedAttributes[index].accepted.includes(value))) {
				return 'admin.remove_warning';
			}
		}
		return '';
	}
	return {
		emptyNewRoom,
		updatePublicRoom,
		updateSecuredRoom,
		getYiviLabelsAndAttributes,
		translateYiviLabelsToAttributes,
		fillInEditFormAttributes,
		attributesChanged,
	};
}

export { useEditRoom };
