// New students start with this many coins (keep in sync with the default in schema.prisma)
export const STARTING_COINS = 100;

// Empty by default so new students only add the bills they actually have.
export const STARTER_BILLS: readonly {
    name: string;
    icon: string;
    amount: number;
}[] = [];