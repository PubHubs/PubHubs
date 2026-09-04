// Policy for `npm run check:audit` (scripts/npm-audit.mjs), the npm counterpart of pubhubs/deny.toml.
//
// `npm audit` reports every advisory that applies to package-lock.json, and the check fails on all of
// them unless they are listed below.  Not every advisory is a problem for us: a URI parser that only
// ever sees our own build's JSON schemas cannot be reached by an attacker, and some advisories have no
// fixed version to move to at all.  Listing an advisory here records *why* we accept it, so the next
// person does not have to work that out again.
//
// Before adding an entry, try to make it go away instead:
//   npm update <package>          picks up a fixed patch or minor release without touching package.json
//   npm audit fix                 the same, for everything npm can fix on its own
//   a bump in package.json        when the fix needs a new major or minor of a direct dependency
//
// Each entry takes:
//   id       the advisory id as the check prints it (a GHSA id, or `npm-<number>` without one)
//   reason   why this advisory is acceptable for us -- required, and the whole point of the file
//   expires  optional YYYY-MM-DD.  Past that date the exception stops working and the check fails
//            again, so "we will deal with this in the next dependency update" cannot be forgotten.
//
// The check also prints the entries that no longer match any advisory; please remove those.
//
// The `npm-audit` pipeline job runs the check on every merge request and on main and stable.  It is
// deliberately not part of `npm run check`: advisories are published all the time, and a new one
// should show up as that job going red, not as an unrelated local check run suddenly failing.
export default {
	// npm severities, weakest first: low < moderate < high < critical.  Anything at this level or
	// above fails the check, so `low` means every advisory needs either a fix or an entry below.
	failOn: 'low',

	ignore: [
		{
			id: 'GHSA-848j-6mx2-7j84',
			reason: "No fixed version exists: 6.6.1 is the latest elliptic release, and the only upgrade npm can suggest is a major downgrade of vite-plugin-node-polyfills. We do not use elliptic ourselves; it arrives through that plugin's crypto-browserify shim, and the advisory is about the strictness of its ECDSA verification.",
		},
		{
			id: 'GHSA-cp6q-959q-f8rh',
			reason: 'Fixed in @tiptap/* 3.30.4, but the tiptap packages pin each other exactly, so `npm update` cannot reach it: it needs the four @tiptap dependencies in hub-client/package.json to move to ^3.31.1 together, which is an editor upgrade with its own regression risk and belongs in a dependency-update merge request.',
			expires: '2026-11-01',
		},
	],
};
