export enum Key {
	CLINICS = 'CLINICS',
}

export enum DynamicKey {
	EXCHANGE_RATES = 'EXCHANGE_RATES',
}

export type DynamicKeyType = `${DynamicKey}_${string}`;

export function getDynamicKey(key: DynamicKey, suffix: string) {
	const dynamic: DynamicKeyType = `${key}_${suffix}`;
	return dynamic;
}
