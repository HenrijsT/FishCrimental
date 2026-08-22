import type Decimal from 'break_eternity.js';
import { d0, parseDecimal } from '$lib/decimal';
import { FISH_TYPES, type FishType } from '$lib/fish_types';
import { FishingSources } from '$lib/fishing_sources';
import { fishes } from '$lib/fishes';
import {
	PRESTIGE_UPGRADE_IDS,
	SAVE_KEY,
	SAVE_VERSION,
	SOURCE_ORDER,
	UPGRADE_IDS,
	type PrestigeUpgradeId,
	type UpgradeId
} from './config';
import { createInitialState } from './engine';
import type { GameState } from './types';

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
	0: (data) => ({ ...data, dex: isRecord(data.dex) ? data.dex : {}, version: 1 })
};

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
			acc[type] = dec(source[type]);
			return acc;
		},
		{} as Record<FishType, Decimal>
	);
}

function readDex(raw: unknown): Record<string, Decimal> {
	const source = isRecord(raw) ? raw : {};
	const dex: Record<string, Decimal> = {};
	for (const [name, value] of Object.entries(source)) {
		// Unknown species names are dropped — they are either corruption or
		// content that no longer exists.
		if (!KNOWN_SPECIES.has(name)) continue;
		const parsed = parseDecimal(value);
		if (parsed && parsed.gt(0)) dex[name] = parsed;
	}
	return dex;
}

function readUpgrades(raw: unknown): Record<UpgradeId, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = dec(source[id]).floor().max(0);
			return acc;
		},
		{} as Record<UpgradeId, Decimal>
	);
}

function readPrestigeUpgrades(raw: unknown): Record<PrestigeUpgradeId, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return PRESTIGE_UPGRADE_IDS.reduce(
		(acc, id) => {
			acc[id] = dec(source[id]).floor().max(0);
			return acc;
		},
		{} as Record<PrestigeUpgradeId, Decimal>
	);
}

function readDeckhands(raw: unknown): Record<FishingSources, Decimal> {
	const source = isRecord(raw) ? raw : {};
	return SOURCE_ORDER.reduce(
		(acc, name) => {
			acc[name] = dec(source[name]).floor().max(0);
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
	// The Pond is always open — otherwise a corrupt save is unplayable.
	unlocked[FishingSources.Pond] = true;
	return unlocked;
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
			: FishingSources.Pond;

	return {
		version: SAVE_VERSION,

		coins: dec(migrated.coins),
		lifetimeCoins: dec(migrated.lifetimeCoins),
		allTimeCoins: dec(migrated.allTimeCoins),

		hold: readHold(migrated.hold),
		holdValue: dec(migrated.holdValue),

		dex: readDex(migrated.dex),
		totalCasts: dec(migrated.totalCasts),
		totalFish: dec(migrated.totalFish),

		unlocked,
		activeSource,

		upgrades: readUpgrades(migrated.upgrades),
		deckhands: readDeckhands(migrated.deckhands),

		pearls: dec(migrated.pearls).floor().max(0),
		allTimePearls: dec(migrated.allTimePearls).floor().max(0),
		prestigeUpgrades,
		prestigeCount: dec(migrated.prestigeCount).floor().max(0),

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

export function deserialize(raw: string): GameState | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;
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

export function loadFromStorage(): GameState | null {
	const store = storage();
	if (!store) return null;

	const raw = store.getItem(SAVE_KEY);
	if (!raw) return null;

	return deserialize(raw);
}

export function clearStorage(): void {
	storage()?.removeItem(SAVE_KEY);
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

export function importSave(blob: string): GameState | null {
	const trimmed = blob.trim();
	if (!trimmed.startsWith(EXPORT_PREFIX)) return null;

	const separator = trimmed.indexOf('.');
	if (separator < 0) return null;

	const version = Number.parseInt(trimmed.slice(EXPORT_PREFIX.length, separator), 10);
	if (!Number.isFinite(version) || version < 0) return null;

	const decoded = fromBase64(trimmed.slice(separator + 1));
	if (decoded === null) return null;

	return deserialize(decoded);
}
