// The sidebar opens the room's tools (shop, wardrobe, piggy bank) without owning their data:
// on the dashboard it sends this event, from any other page it navigates to /?open=<tool>.
export const ROOM_OPEN_EVENT = "moneypixel:open-tool";

export type RoomTool = "shop" | "wardrobe" | "piggy" | "ai";

export const isRoomTool = (v: unknown): v is RoomTool =>
    v === "shop" || v === "wardrobe" || v === "piggy" || v === "ai";