// New students start with this many coins (keep in sync with the default in schema.prisma)
export const STARTING_COINS = 100;

// Created for every new student on first sign-in (see events.createUser in auth.ts).
// `icon` is a key used by components/finance/BillsTracker.tsx.
export const STARTER_BILLS = [
    { name: "Dorm Rent", icon: "home", amount: 3500 },
    { name: "Water & Electricity", icon: "zap", amount: 450 },
    { name: "Phone / Internet", icon: "smartphone", amount: 399 },
    { name: "Streaming", icon: "tv", amount: 169 },
] as const;