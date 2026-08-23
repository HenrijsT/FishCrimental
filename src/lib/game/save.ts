import { d0, parseDecimal } from '$lib/decimal';
import { FISH_TYPES, type FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { fishes } from '$lib/fishes';
import Decimal from 'break_eternity.js';
import {
	BOAT_SOURCES,
	BOAT_UPGRADES,
	BOAT_UPGRADE_IDS,
	LICENCES,
	LICENCE_IDS,
	PRESTIGE_UPGRADES,
	PRESTIGE_UPGRADE_IDS,
	AUTO_FISHER,
	BUCKET_MAX_LEVEL,
	MAP_MAX_LEVEL,
	SAVE_BACKUP_KEY,
	TOWN_TRIP_SECONDS,
	TRADER_PERIOD_SECONDS,
	SAVE_KEY,
	POND_MAX,
	POND_MAX_LEVEL,
	SAVE_VERSION,
	SOURCE_ORDER,
	UPGRADES,
	UPGRADE_IDS,
	type BoatUpgradeId,
	type LicenceId,
	type PrestigeUpgradeId,
	type UpgradeId
} from './config';
import { createInitialState } from './engine';
import { LEGACY_SPECIES } from './market';
import type { BoatState, GameState, PondState, SpeciesLedger } from './types';

const EXPORT_PREFIX = 'FISHC';

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function dec(value: unknown, fallback: Decimal = d0()): Decimal {
	return parseDecimal(value) ?? fallback;
}

/** Currencies and counts can never be negative, whatever the file says. */
function positive(value: unknown, fallback: Decimal = d0()): Decimal {
	return dec(value, fallback).max(0);
}

/**
 * A wall-clock deadline that can never be further away than one trip.
 *
 * Also catches a clock that has moved backwards since the save was written.
 */
function clampDeadline(value: unknown): number {
	const parsed = num(value, 0);
	if (parsed <= 0) return 0;
	return Math.min(parsed, Date.now() + TOWN_TRIP_SECONDS * 1000);
}

function clampTraderDeadline(value: unknown): number {
	const parsed = num(value, 0);
	if (parsed <= 0) return 0;
	return Math.min(parsed, Date.now() + TRADER_PERIOD_SECONDS * 1000);
}

/** Whole, non-negative, and never above the ceiling the game defines. */
function level(value: unknown, max: number): Decimal {
	return Decimal.min(dec(value).floor().max(0), max);
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

/**
 * Each entry upgrades a save from version `n` to `n + 1`. Saves are run through
 * every step between their stored version and `SAVE_VERSION`, so old saves keep
 * loading as the shape changes.
 */
export const MIGRATIONS: Record<number, (data: Raw) => Raw> = {
	// 0 → 1: pre-release saves had no version field and no `dex`.
	0: (data) => ({ ...data, dex: isRecord(data.dex) ? data.dex : {}, version: 1 }),
	// 1 → 2: catches became whole fish, backed by the `carry` remainder bank.
	// Version 1 holds could contain fractional fish; round them down so nothing
	// in the game is ever a fraction of a fish again.
	1: (data) => ({
		...data,
		carry: {},
		hold: floorHold(data.hold),
		dex: floorDex(data.dex),
		version: 2
	}),
	// 2 → 3: licences and the boat. A run already in progress keeps the water it
	// opened — the licences covering it are granted retroactively rather than
	// taken away from a player mid-run, and a boat is handed over free if they
	// had already unlocked open water.
	2: (data) => ({
		...data,
		licences: grandfatherLicences(data.unlocked),
		boat: grandfatherBoat(data.unlocked),
		version: 3
	}),
	// 3 → 4: the auto-fisher. Purely additive — a version 3 save simply has not
	// bought one, which is what the defaults below already say. The step exists
	// so the version is stamped explicitly rather than by `fromRaw`'s fallback.
	3: (data) => ({ ...data, autoFisher: '0', autoFisherOffline: false, version: 4 }),
	// 4 → 5: the mud pool became the first source, and the opening act arrived.
	// Purely additive — every new field reads its default — but the version is
	// stamped explicitly rather than left to `fromRaw`'s fallback, and the bump
	// makes an older build refuse the save instead of dropping the new source.
	4: (data) => ({
		...data,
		bucketLevel: '0',
		hasBicycle: false,
		hasAssistant: false,
		fishingBlockedUntil: 0,
		nextTraderAt: 0,
		traderVisits: 0,
		mapLevel: '0',
		version: 5
	}),

	// 5 → 6: the fifth pass. The one bump the whole pass shares.
	//
	// Two things arrive together. The travelling merchant stopped seizing the
	// hold and started settling a consignment (R65), so there is a second fish
	// ledger to persist. And the fish market (R49/R50) prices per *species*,
	// which a pre-market save has no record of — `hold` is six `FishType`
	// buckets and `holdValue` is one scalar, and neither can be un-mixed.
	//
	// So the old aggregate is parked under the reserved empty-species key. Both
	// market functions special-case it to knowledge 1 and price 1: it sells once
	// at a neutral price and never reappears. Inventing a species split would be
	// making the fish up.
	//
	// The bump also makes an older build refuse the save outright rather than
	// silently dropping fish the player has already listed.
	5: (data) => ({
		...data,
		consignment: {},
		consignmentValue: '0',
		holdSpecies: {
			fish: {
				[LEGACY_SPECIES]: floorString(data.holdValue !== undefined ? countOf(data.hold) : '0')
			},
			worth: { [LEGACY_SPECIES]: String(data.holdValue ?? '0') }
		},
		consignmentSpecies: { fish: {}, worth: {} },
		marketPressure: {},
		version: 6
	})
};

/** Total fish across the six buckets of a raw hold, as a string. */
function countOf(raw: unknown): string {
	const source = isRecord(raw) ? raw : {};
	let total = d0();
	for (const value of Object.values(source)) {
		const parsed = parseDecimal(value);
		if (parsed && parsed.gt(0)) total = total.plus(parsed);
	}
	return total.toJSON() as string;
}

function floorString(value: string): string {
	const parsed = parseDecimal(value);
	return parsed && parsed.gt(0) ? (parsed.floor().toJSON() as string) : '0';
}

function grandfatherLicences(unlocked: unknown): Raw {
	const open = isRecord(unlocked) ? unlocked : {};
	const granted: Raw = {};
	for (const id of LICENCE_IDS) {
		granted[id] = LICENCES[id].covers.some((source) => open[source] === true);
	}
	return granted;
}

function grandfatherBoat(unlocked: unknown): Raw {
	const open = isRecord(unlocked) ? unlocked : {};
	const hadOpenWater = BOAT_SOURCES.some((source) => open[source] === true);
	return hadOpenWater ? { owned: true, fuel: '0', condition: 100, upgrades: {} } : {};
}

function floorHold(raw: unknown): Raw {
	const source = isRecord(raw) ? raw : {};
	const out: Raw = {};
	for (const [type, value] of Object.entries(source)) {
		const parsed = parseDecimal(value);
		out[type] = (parsed ?? d0()).floor().toJSON();
	}
	return out;
}

function floorDex(raw: unknown): Raw {
	const source = isRecord(raw) ? raw : {};
	const out: Raw = {};
	for (const [name, value] of Object.entries(source)) {
		const parsed = parseDecimal(value);
		if (parsed && parsed.gte(1)) out[name] = parsed.floor().toJSON();
	}
	return out;
}

/** A save written by a newer build than this one. */
export class FutureSaveError extends Error {
	constructor(public readonly version: number) {
		super(`save version ${version} is newer than this build (${SAVE_VERSION})`);
		this.name = 'FutureSaveError';
	}
}

export function isFutureSave(data: Raw): boolean {
	return num(data.version, 0) > SAVE_VERSION;
}

export function migrate(data: Raw): Raw {
	let current = data;
	let version = num(current.version, 0);

	while (version < SAVE_VERSION) {
		const step = MIGRATIONS[version];
		if (!step) break;
		current = step(current);
		const next = num(current.version, version + 1);
		version = next > version ? next : version + 1;
		current.version = version;
	}

	return current;
}

// ---------------------------------------------------------------------------
// Serialise
// ---------------------------------------------------------------------------

export function serialize(state: GameState): string {
	return JSON.stringify({ ...state, version: SAVE_VERSION });
}

// ---------------------------------------------------------------------------
// Deserialise
// ---------------------------------------------------------------------------

const KNOWN_SPECIES = new Set(Object.keys(fishes));

function readHold(raw: unknown): Record<FishType, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return FISH_TYPES.reduce(
		(acc, type) => {
			acc[type] = positive(source[type]).floor();
			return acc;
		},
		{} as Record<FishType, Decimal>
	);
}

/**
 * The remainder bank. Every entry is a fraction of a unit, so anything outside
 * `[0, 1)` is corruption and is dropped rather than trusted.
 */
function readCarry(raw: unknown): Record<string, number> {
	const source = isRecord(raw) ? raw : {};
	const carry: Record<string, number> = {};
	for (const [key, value] of Object.entries(source)) {
		if (typeof value !== 'number' || !Number.isFinite(value)) continue;
		if (value <= 0 || value >= 1) continue;
		carry[key] = value;
	}
	return carry;
}

function readDex(raw: unknown): Record<string, Decimal> {
	const source = isRecord(raw) ? raw : {};
	const dex: Record<string, Decimal> = {};
	for (const [name, value] of Object.entries(source)) {
		// Unknown species names are dropped — they are either corruption or
		// content that no longer exists.
		if (!KNOWN_SPECIES.has(name)) continue;
		const parsed = parseDecimal(value);
		if (parsed && parsed.gte(1)) dex[name] = parsed.floor();
	}
	return dex;
}

/**
 * A species-keyed pile of Decimals — the market book, and half a side-ledger.
 *
 * Unknown names are dropped exactly as `readDex` drops them: corruption, or
 * content that no longer exists. The empty-string key is the legacy bucket
 * (`LEGACY_SPECIES`) where a pre-market save's aggregate `holdValue` is parked,
 * so it is allowed through.
 */
function readSpeciesPile(raw: unknown, floorIt: boolean): Record<string, Decimal> {
	const source = isRecord(raw) ? raw : {};
	const pile: Record<string, Decimal> = {};
	for (const [name, value] of Object.entries(source)) {
		if (name !== LEGACY_SPECIES && !KNOWN_SPECIES.has(name)) continue;
		const parsed = parseDecimal(value);
		if (!parsed || parsed.lte(0)) continue;
		pile[name] = floorIt ? parsed.floor() : parsed;
	}
	return pile;
}

/**
 * A side-ledger.
 *
 * Counts are floored and worths are not, which mirrors the v1 `floorHold`
 * migration: `hold` holds whole fish and `holdValue` is money. Flooring one and
 * not the other is what keeps the two sources of truth from diverging on load.
 */
function readLedger(raw: unknown): SpeciesLedger {
	const source = isRecord(raw) ? raw : {};
	return {
		fish: readSpeciesPile(source.fish, true),
		worth: readSpeciesPile(source.worth, false)
	};
}

/**
 * Breeding ponds.
 *
 * Capped at `POND_MAX` on the way in, and an unknown species is read as an
 * unstocked pond rather than dropped — the pond was paid for, and losing it
 * because a fish was renamed would be worse than losing what it was breeding.
 */
function readPonds(raw: unknown): PondState[] {
	if (!Array.isArray(raw)) return [];
	return raw.slice(0, POND_MAX).map((entry) => {
		const source = isRecord(entry) ? entry : {};
		const species =
			typeof source.species === 'string' && KNOWN_SPECIES.has(source.species)
				? source.species
				: null;
		return { species, level: level(source.level, POND_MAX_LEVEL) };
	});
}

function readUpgrades(raw: unknown): Record<UpgradeId, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = level(source[id], UPGRADES[id].maxLevel);
			return acc;
		},
		{} as Record<UpgradeId, Decimal>
	);
}

function readPrestigeUpgrades(raw: unknown): Record<PrestigeUpgradeId, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return PRESTIGE_UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = level(source[id], PRESTIGE_UPGRADES[id].maxLevel);
			return acc;
		},
		{} as Record<PrestigeUpgradeId, Decimal>
	);
}

function readDeckhands(raw: unknown): Record<FishingSources, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return SOURCE_ORDER.reduce(
		(acc, name) => {
			acc[name] = positive(source[name]).floor();
			return acc;
		},
		{} as Record<FishingSources, Decimal>
	);
}

function readUnlocked(raw: unknown, fallback: Record<FishingSources, boolean>) {
	const source = isRecord(raw) ? raw : {};
	const unlocked = SOURCE_ORDER.reduce(
		(acc, name) => {
			acc[name] = bool(source[name], fallback[name]);
			return acc;
		},
		{} as Record<FishingSources, boolean>
	);
	// The first source is always open — otherwise a corrupt save is unplayable.
	//
	// This MUST be `SOURCE_ORDER[0]` and not a named source. With a literal
	// here, prepending a new first source silently hands every reloading player
	// the old first source for free, permanently, bypassing its unlock cost.
	unlocked[SOURCE_ORDER[0]] = true;
	return unlocked;
}

function readLicences(raw: unknown): Record<LicenceId, boolean> {
	const source = isRecord(raw) ? raw : {};
	return LICENCE_IDS.reduce(
		(acc, id) => {
			acc[id] = bool(source[id], false);
			return acc;
		},
		{} as Record<LicenceId, boolean>
	);
}

function readBoat(raw: unknown): BoatState {
	const source = isRecord(raw) ? raw : {};
	const upgrades = isRecord(source.upgrades) ? source.upgrades : {};

	return {
		owned: bool(source.owned, false),
		fuel: positive(source.fuel),
		// Condition is a bounded dial; anything outside 0-100 is corruption.
		condition: Math.max(0, Math.min(100, num(source.condition, 100))),
		upgrades: BOAT_UPGRADE_IDS.reduce(
			(acc, id) => {
				acc[id] = level(upgrades[id], BOAT_UPGRADES[id].maxLevel);
				return acc;
			},
			{} as Record<BoatUpgradeId, Decimal>
		)
	};
}

function readAchievements(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Rebuild a `GameState` from parsed JSON. Anything missing or malformed falls
 * back to its default rather than failing the whole load — a save that is
 * 90% readable is worth more to a player than a clean error.
 */
export function fromRaw(data: Raw): GameState {
	const base = createInitialState();
	const migrated = migrate(data);

	const prestigeUpgrades = readPrestigeUpgrades(migrated.prestigeUpgrades);
	const unlocked = readUnlocked(migrated.unlocked, base.unlocked);

	const settingsRaw = isRecord(migrated.settings) ? migrated.settings : {};

	const activeSource =
		typeof migrated.activeSource === 'string' &&
		(SOURCE_ORDER as string[]).includes(migrated.activeSource) &&
		unlocked[migrated.activeSource as FishingSources]
			? (migrated.activeSource as FishingSources)
			: SOURCE_ORDER[0];

	return {
		version: SAVE_VERSION,

		coins: positive(migrated.coins),
		lifetimeCoins: positive(migrated.lifetimeCoins),
		allTimeCoins: positive(migrated.allTimeCoins),

		hold: readHold(migrated.hold),
		holdValue: positive(migrated.holdValue),

		consignment: readHold(migrated.consignment),
		consignmentValue: positive(migrated.consignmentValue),

		holdSpecies: readLedger(migrated.holdSpecies),
		consignmentSpecies: readLedger(migrated.consignmentSpecies),
		marketPressure: readSpeciesPile(migrated.marketPressure, false),
		// A book loaded with no timestamp has not decayed yet, not decayed
		// forever. `settleMarket` runs immediately after the load.
		marketUpdatedAt: num(migrated.marketUpdatedAt, Date.now()),

		ponds: readPonds(migrated.ponds),

		dex: readDex(migrated.dex),
		carry: readCarry(migrated.carry),
		totalCasts: positive(migrated.totalCasts).floor(),
		totalFish: positive(migrated.totalFish).floor(),

		unlocked,
		activeSource,

		licences: readLicences(migrated.licences),
		boat: readBoat(migrated.boat),

		upgrades: readUpgrades(migrated.upgrades),
		deckhands: readDeckhands(migrated.deckhands),
		// Clamped like the town trip: a deadline far in the future would stop the
		// trader ever arriving again.
		nextTraderAt: clampTraderDeadline(migrated.nextTraderAt),
		traderVisits: Math.max(0, Math.floor(num(migrated.traderVisits, 0))),
		mapLevel: level(migrated.mapLevel, MAP_MAX_LEVEL),
		bucketLevel: level(migrated.bucketLevel, BUCKET_MAX_LEVEL),
		hasBicycle: bool(migrated.hasBicycle, false),
		// Clamped, not just parsed. `num()` only checks finiteness, so a
		// hand-edited or clock-skewed `Date.now() + 1e15` would refuse manual
		// casting forever with no way back.
		fishingBlockedUntil: clampDeadline(migrated.fishingBlockedUntil),
		hasAssistant: bool(migrated.hasAssistant, false),
		autoFisher: level(migrated.autoFisher, AUTO_FISHER.maxLevel),
		// The rig cannot be running offline if it does not exist.
		autoFisherOffline:
			bool(migrated.autoFisherOffline, false) &&
			level(migrated.autoFisher, AUTO_FISHER.maxLevel).gt(0),

		pearls: positive(migrated.pearls).floor(),
		allTimePearls: positive(migrated.allTimePearls).floor(),
		prestigeUpgrades,
		prestigeCount: positive(migrated.prestigeCount).floor(),

		achievements: readAchievements(migrated.achievements),
		completed: bool(migrated.completed, false),
		jellyJokeSeen: bool(migrated.jellyJokeSeen, false),
		eroticJokeSeen: bool(migrated.eroticJokeSeen, false),

		startedAt: num(migrated.startedAt, base.startedAt),
		lastUpdate: num(migrated.lastUpdate, Date.now()),
		playTime: Math.max(0, num(migrated.playTime, 0)),

		settings: {
			offlineProgress: bool(settingsRaw.offlineProgress, true),
			reduceMotion: bool(settingsRaw.reduceMotion, false),
			scientificNotation: bool(settingsRaw.scientificNotation, false)
		}
	};
}

/**
 * A save written by a newer build is left strictly alone. Loading it would
 * drop whatever fields this build does not know about, and the next autosave
 * would write the truncated version back over the player's real progress.
 */
export function deserialize(raw: string): GameState | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;
	if (isFutureSave(parsed)) throw new FutureSaveError(num(parsed.version, 0));
	return fromRaw(parsed);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storage(): Storage | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		return localStorage;
	} catch {
		return null;
	}
}

export function saveToStorage(state: GameState): boolean {
	const store = storage();
	if (!store) return false;
	try {
		store.setItem(SAVE_KEY, serialize(state));
		return true;
	} catch {
		return false;
	}
}

export type LoadOutcome =
	| { kind: 'loaded'; state: GameState }
	| { kind: 'empty' }
	| { kind: 'corrupt' }
	| { kind: 'future'; version: number };

/**
 * Never throws and never guesses. A save this build cannot safely read comes
 * back labelled so the caller can refuse to overwrite it.
 */
export function loadFromStorage(): LoadOutcome {
	const store = storage();
	if (!store) return { kind: 'empty' };

	const raw = store.getItem(SAVE_KEY);
	if (!raw) return { kind: 'empty' };

	try {
		const state = deserialize(raw);
		return state ? { kind: 'loaded', state } : { kind: 'corrupt' };
	} catch (error) {
		if (error instanceof FutureSaveError) return { kind: 'future', version: error.version };
		return { kind: 'corrupt' };
	}
}

export function clearStorage(): void {
	storage()?.removeItem(SAVE_KEY);
}

/**
 * The save exactly as it sits on disk, unparsed.
 *
 * A save this build cannot read still has to be rescuable — exported, or
 * copied aside before the player dismisses the banner protecting it — and
 * neither of those can go through `deserialize`, which is what could not read
 * it in the first place.
 */
export function readRawSave(): string | null {
	return storage()?.getItem(SAVE_KEY) ?? null;
}

/** Copy a raw save to the backup key. Returns false if storage refused it. */
export function backupRawSave(raw: string): boolean {
	const store = storage();
	if (!store) return false;
	try {
		store.setItem(SAVE_BACKUP_KEY, raw);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Export / import blob
// ---------------------------------------------------------------------------

function toBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(encoded: string): string | null {
	try {
		const binary = atob(encoded);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

/** `FISHC1.<base64>` — one line, safe to paste anywhere. */
export function exportSave(state: GameState): string {
	return `${EXPORT_PREFIX}${SAVE_VERSION}.${toBase64(serialize(state))}`;
}

/**
 * Wrap a raw save verbatim, for a blob this build could not parse.
 *
 * The player's only copy of a future or damaged save is the one on disk, so
 * the export has to carry the original bytes rather than the blank game that
 * was started in its place.
 */
export function exportRawSave(raw: string): string {
	let version = SAVE_VERSION;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isRecord(parsed)) version = num(parsed.version, SAVE_VERSION);
	} catch {
		// Unparseable is exactly the case this exists for; hand it back as-is.
	}
	return `${EXPORT_PREFIX}${version}.${toBase64(raw)}`;
}

/** Returns null for anything this build cannot safely read, including future saves. */
export function importSave(blob: string): GameState | null {
	const trimmed = blob.trim();
	if (!trimmed.startsWith(EXPORT_PREFIX)) return null;

	const separator = trimmed.indexOf('.');
	if (separator < 0) return null;

	const version = Number.parseInt(trimmed.slice(EXPORT_PREFIX.length, separator), 10);
	if (!Number.isFinite(version) || version < 0) return null;

	const decoded = fromBase64(trimmed.slice(separator + 1));
	if (decoded === null) return null;

	try {
		return deserialize(decoded);
	} catch {
		return null;
	}
}
