const thb = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const formatCurrency = (n: number) => thb.format(n);

export const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

// Month helpers now follow Asia/Bangkok on any server (see lib/time.ts)
export { monthKey, monthRange } from "@/lib/time";