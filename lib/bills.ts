// Shared by the server actions (validation) and BillsTracker (icon picker)
export const BILL_ICON_KEYS = ["home", "zap", "droplets", "smartphone", "wifi", "tv", "bus", "book", "receipt"] as const;
export type BillIconKey = (typeof BILL_ICON_KEYS)[number];

export const isBillIcon = (v: unknown): v is BillIconKey => (BILL_ICON_KEYS as readonly string[]).includes(v as string);

export const MAX_BILLS = 20; // per student