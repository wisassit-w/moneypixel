import writeXlsxFile, { type Cell, type SheetData } from "write-excel-file/node";
import { translator, type ExportData } from "@/lib/export/types";

const SAGE = "#4e6e58";
const INCOME = "#3f5a47";
const EXPENSE = "#be123c";
const MONEY = "#,##0.00";

const head = (value: string, align: "left" | "right" = "left"): Cell => ({
    value,
    fontWeight: "bold",
    textColor: "#ffffff",
    backgroundColor: SAGE,
    align,
    alignVertical: "center",
});

/**
 * Excel workbook with two sheets: a summary and the transactions.
 * Text is stored as UTF-8 XML, so Thai opens correctly. Text cells are never formulas.
 */
export async function buildXlsx(data: ExportData): Promise<Buffer> {
    const t = translator(data.lang);
    const s = data.summary;

    const label = (value: string): Cell => ({ value, fontWeight: "bold" });
    const money = (value: number, textColor?: string): Cell => ({
        value,
        type: Number,
        format: MONEY,
        align: "right",
        fontWeight: "bold",
        textColor,
    });

    const summarySheet: SheetData = [
        [{ value: `MoneyPixel · ${data.monthLabel}`, fontWeight: "bold", fontSize: 16, textColor: SAGE }, null],
        [null, null],
        [head(t("export.item")), head(t("csv.amount"), "right")],
        [label(t("sum.income")), money(s.income, INCOME)],
        [label(t("sum.spent")), money(s.expense, EXPENSE)],
        [label(t("export.balance")), money(data.balance, data.balance >= 0 ? INCOME : EXPENSE)],
        [null, null],
        [label(t("export.savingsRate")), { value: s.savingsRate === null ? "-" : `${s.savingsRate}%`, align: "right" }],
        [label(t("sum.txLogged")), { value: s.txCount, type: Number, align: "right" }],
        [label(t("sum.coinsEarned")), { value: s.coinsEarned, type: Number, align: "right" }],
        [label(t("sum.expEarned")), { value: s.expEarned, type: Number, align: "right" }],
    ];

    const rows: SheetData = [
        [
            head(t("csv.date")),
            head(t("csv.type")),
            head(t("csv.category")),
            head(t("csv.description")),
            head(t("csv.amount"), "right"),
            head(t("csv.coins"), "right"),
            head(t("csv.exp"), "right"),
        ],
        ...data.rows.map((r): Cell[] => [
            { value: r.date },
            { value: r.typeLabel },
            { value: r.categoryLabel },
            { value: r.description },
            {
                value: r.amount,
                type: Number,
                format: MONEY,
                align: "right",
                textColor: r.type === "income" ? INCOME : EXPENSE,
            },
            { value: r.coinsAwarded, type: Number, align: "right" },
            { value: r.expAwarded, type: Number, align: "right" },
        ]),
    ];

    return writeXlsxFile([
        { sheet: t("export.sheetSummary"), data: summarySheet, columns: [{ width: 30 }, { width: 18 }] },
        {
            sheet: t("export.sheetTransactions"),
            data: rows,
            columns: [{ width: 13 }, { width: 12 }, { width: 24 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 14 }],
            stickyRowsCount: 1,
        },
    ]).toBuffer();
}