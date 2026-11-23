export type Gender = "male" | "female" | "unisex";
export type Slot = "hat" | "shirt" | "pants" | "shoes";
export type PetType = "none" | "cat" | "dog";

export const GENDERS: { id: Gender; label: string; desc: string }[] = [
    { id: "male", label: "Male", desc: "Short hair" },
    { id: "female", label: "Female", desc: "Long hair" },
    { id: "unisex", label: "Unisex", desc: "Bob cut" },
];

export type Item = {
    id: string;
    slot: Slot;
    name: string;
    price: number; // coins, 0 = free
    color: string;
    accent?: string;
    style: string; // drives the pixel shape in lib/avatar.ts
};

export const ITEMS: Record<Slot, Item[]> = {
    hat: [
        { id: "none", slot: "hat", name: "No hat", price: 0, color: "#000000", style: "none" },
        { id: "student_cap", slot: "hat", name: "Student Cap", price: 0, color: "#1e3a5f", style: "cap" },
        { id: "bucket_hat", slot: "hat", name: "Bucket Hat", price: 60, color: "#d9c6a5", style: "bucket" },
        { id: "cat_ears", slot: "hat", name: "Cat Ears", price: 120, color: "#2f2f3a", accent: "#f4a6b8", style: "ears" },
        { id: "headphones", slot: "hat", name: "Headphones", price: 150, color: "#2d2d3a", accent: "#8fb59a", style: "headphones" },
    ],
    shirt: [
        { id: "casual_indigo", slot: "shirt", name: "Indigo Student Shirt", price: 0, color: "#6366f1", style: "tee" },
        { id: "beige_hoodie", slot: "shirt", name: "Beige Hoodie", price: 0, color: "#d9c6a5", style: "hoodie" },
        { id: "sage_tee", slot: "shirt", name: "Sage Tee", price: 0, color: "#4e6e58", style: "tee" },
        { id: "oversized_sweater", slot: "shirt", name: "Oversized Sweater", price: 90, color: "#e2c9a8", style: "sweater" },
        { id: "sport_jersey", slot: "shirt", name: "Sport Jersey", price: 120, color: "#fbbf24", accent: "#1e3a5f", style: "jersey" },
    ],
    pants: [
        { id: "jeans_dark", slot: "pants", name: "Dark Jeans", price: 0, color: "#3b3b58", style: "pants" },
        { id: "chino_beige", slot: "pants", name: "Chino Pants", price: 50, color: "#cdb892", style: "pants" },
        { id: "cargo_shorts", slot: "pants", name: "Cargo Shorts", price: 70, color: "#6b7a4f", style: "shorts" },
        { id: "pleated_skirt", slot: "pants", name: "Pleated Skirt", price: 100, color: "#b07a86", style: "skirt" },
        { id: "sweatpants", slot: "pants", name: "Sweatpants", price: 40, color: "#9ca3af", style: "pants" },
    ],
    shoes: [
        { id: "sneakers_white", slot: "shoes", name: "White Sneakers", price: 0, color: "#f5f5f4", style: "sneaker" },
        { id: "canvas_shoes", slot: "shoes", name: "Canvas Shoes", price: 50, color: "#c9b79c", style: "canvas" },
        { id: "running_shoes", slot: "shoes", name: "Running Shoes", price: 100, color: "#e5e7eb", accent: "#f59e0b", style: "runner" },
        { id: "loafers", slot: "shoes", name: "Loafers", price: 80, color: "#5c3a22", style: "loafer" },
    ],
};

export const getItem = (slot: Slot, id: string): Item | undefined => ITEMS[slot]?.find((i) => i.id === id);

export const csv = (s: string | null | undefined) => (s ?? "").split(",").filter(Boolean);

export const isGender = (v: unknown): v is Gender => v === "male" || v === "female" || v === "unisex";
export const asGender = (v: string): Gender => (isGender(v) ? v : "male");
export const asPet = (v: string): PetType => (v === "cat" || v === "dog" ? v : "none");

export const FURNITURE = {
    tv: { name: "Smart TV", price: 150 },
    sofa: { name: "Cozy Sofa", price: 200 },
    treadmill: { name: "Active Treadmill", price: 250 },
} as const;
export type FurnitureKey = keyof typeof FURNITURE;

export const PET_PRICE = 300;