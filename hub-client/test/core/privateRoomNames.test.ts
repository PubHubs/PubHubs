import { expect, test } from 'vitest';
import { createNewPrivateRoomName, updatePrivateRoomName, isVisiblePrivateRoom, fetchMemberIdsFromPrivateRoomName } from '@/core/privateRoomNames.ts';

test('createNewPrivateRoomName', () => {
	expect(createNewPrivateRoomName([{ userId: '@IK' }, { userId: '@JIJ' }])).toBe('@IK,@JIJ');
	expect(createNewPrivateRoomName([{ userId: '@ik.dus:domain.net' }, { userId: '@jij.dus:domain.net' }])).toBe('@ik.dus:domain.net,@jij.dus:domain.net');
});

test('updatePrivateRoomName', () => {
	const me = { userId: '@me.dus:domain.net' };
	const other = { userId: '@other.dus:domain.net' };
	let name = createNewPrivateRoomName([me, other]);
	expect(name).toBe('@me.dus:domain.net,@other.dus:domain.net');
	name = updatePrivateRoomName(name, me, false);
	expect(name).toBe('@me.dus:domain.net,@other.dus:domain.net');
	name = updatePrivateRoomName(name, me, true);
	expect(name).toBe('_@me.dus:domain.net,@other.dus:domain.net');
	name = updatePrivateRoomName(name, other, true);
	expect(name).toBe('_@me.dus:domain.net,_@other.dus:domain.net');
	name = updatePrivateRoomName(name, other, false);
	expect(name).toBe('_@me.dus:domain.net,@other.dus:domain.net');
	name = updatePrivateRoomName(name, me, false);
	expect(name).toBe('@me.dus:domain.net,@other.dus:domain.net');
	name = updatePrivateRoomName('_@some_bot:d.lol,@x:d.lol', { userId: '@some_bot:d.lol' }, false);
	expect(name).toBe('@some_bot:d.lol,@x:d.lol');
});

test('isVisiblePrivateRoom', () => {
	const me = { userId: '@me.dus:domain.net' };
	const other = { userId: '@other.dus:domain.net' };
	let name = createNewPrivateRoomName([me, other]);
	expect(isVisiblePrivateRoom(name, me)).toBe(true);
	expect(isVisiblePrivateRoom(name, other)).toBe(true);
	name = updatePrivateRoomName(name, me, true);
	expect(isVisiblePrivateRoom(name, me)).toBe(false);
	expect(isVisiblePrivateRoom(name, other)).toBe(true);
	name = updatePrivateRoomName(name, other, true);
	expect(isVisiblePrivateRoom(name, me)).toBe(false);
	expect(isVisiblePrivateRoom(name, other)).toBe(false);
});

test('fetchMemberIdsFromPrivateRoomName', () => {
	expect(fetchMemberIdsFromPrivateRoomName('@me.dus:domain.net,@other.dus:domain.net')).toStrictEqual(['@me.dus:domain.net', '@other.dus:domain.net']);
	expect(fetchMemberIdsFromPrivateRoomName('_@me.dus:domain.net,@other.dus:domain.net')).toStrictEqual(['@me.dus:domain.net', '@other.dus:domain.net']);
	expect(fetchMemberIdsFromPrivateRoomName('@me.dus:domain.net,_@other.dus:domain.net')).toStrictEqual(['@me.dus:domain.net', '@other.dus:domain.net']);
	expect(fetchMemberIdsFromPrivateRoomName('_@me.dus:domain.net,_@other.dus:domain.net')).toStrictEqual(['@me.dus:domain.net', '@other.dus:domain.net']);
});
