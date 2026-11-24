import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { translator, type ExportData } from "@/lib/export/types";

// Thai needs an embedded font: PDF's built-in fonts have no Thai letters.
// Sarabun (SIL Open Font License) lives in public/fonts. PDFKit applies Thai vowel and tone-mark positioning.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
let fontCache: { regular: Buffer; bold: Buffer } | null = null;

function loadFonts() {
    fontCache ??= {
        regular: fs.readFileSync(path.join(FONT_DIR, "Sarabun-Regular.ttf")),
        bold: fs.readFileSync(path.join(FONT_DIR, "Sarabun-Bold.ttf")),
    };
    return fontCache;
}

const SAGE = "#4e6e58";
const INK = "#292524";
const MUTED = "#6b645e";
const INCOME = "#3f5a47";
const EXPENSE = "#be123c";
const CARD = "#f4f1ea";
const STRIPE = "#faf8f4";
const LINE = "#e7e2d8";

const MARGIN = 40;
const ROW_H = 21;
const MAX_PDF_ROWS = 2_000; // a month never needs more; keeps the file small and fast

const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht = (n: number) => `฿${number.format(Math.abs(n))}`;

/** A one-month financial report: summary cards, top spending and a transaction table. */
export function buildPdf(data: ExportData): Promise<Buffer> {
    const t = translator(data.lang);
    const fonts = loadFonts();
    const s = data.summary;

    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margin: MARGIN,
            bufferPages: true, // lets us write "page 1 / 3" afterwards
            info: { Title: `MoneyPixel ${data.month}`, Author: "MoneyPixel" },
        });
        doc.registerFont("body", fonts.regular);
        doc.registerFont("bold", fonts.bold);

        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const W = doc.page.width;
        const H = doc.page.height;
        const contentW = W - MARGIN * 2;

        /** One line of text clipped to `width` with "…" (never wraps into the next row). */
        const line = (text: string, x: number, y: number, width: number, opts: PDFKit.Mixins.TextOptions = {}) => {
            doc.text(text, x, y, { width, height: doc.currentLineHeight(), ellipsis: true, lineGap: 0, ...opts });
        };

        // ---------- header band ----------
        doc.rect(0, 0, W, 88).fill(SAGE);
        doc.fillColor("#ffffff").font("bold").fontSize(22);
        line("MoneyPixel", MARGIN, 20, contentW / 2);
        doc.font("body").fontSize(11).fillColor("#e7efe9");
        line(t("export.pdfTitle"), MARGIN, 50, contentW / 2);
        doc.font("bold").fontSize(17).fillColor("#ffffff");
        line(data.monthLabel, MARGIN + contentW / 2, 30, contentW / 2, { align: "right" });

        // ---------- summary cards ----------
        const gap = 12;
        const cardW = (contentW - gap * 2) / 3;
        const cardY = 108;
        const cards: { label: string; value: string; color: string }[] = [
            { label: t("sum.income"), value: baht(s.income), color: INCOME },
            { label: t("sum.spent"), value: baht(s.expense), color: EXPENSE },
            {
                label: t("export.balance"),
                value: `${data.balance < 0 ? "-" : ""}${baht(data.balance)}`,
                color: data.balance >= 0 ? INCOME : EXPENSE,
            },
        ];
        cards.forEach((c, i) => {
            const x = MARGIN + i * (cardW + gap);
            doc.roundedRect(x, cardY, cardW, 64, 10).fill(CARD);
            doc.font("body").fontSize(10).fillColor(MUTED);
            line(c.label, x + 14, cardY + 10, cardW - 28);
            doc.font("bold").fontSize(18).fillColor(c.color);
            line(c.value, x + 14, cardY + 30, cardW - 28);
        });

        let y = cardY + 64 + 12;

        doc.font("body").fontSize(9.5).fillColor(MUTED);
        line(
            `${t("sum.txLogged")}: ${s.txCount}     ·     ${t("sum.coinsEarned")}: ${s.coinsEarned}     ·     ${t("sum.expEarned")}: ${s.expEarned}`,
            MARGIN,
            y,
            contentW,
        );
        y += 24;

        // ---------- top spending ----------
        if (s.topCategories.length > 0) {
            doc.font("bold").fontSize(12).fillColor(INK);
            line(t("sum.topSpending"), MARGIN, y, contentW);
            y += 22;
            for (const c of s.topCategories) {
                doc.font("body").fontSize(10).fillColor(INK);
                line(t(`cat.${c.category}`) || c.category, MARGIN, y, contentW - 110);
                doc.font("bold").fillColor(EXPENSE);
                line(baht(c.amount), MARGIN + contentW - 100, y, 100, { align: "right" });
                y += 18;
            }
            y += 10;
        }

        // ---------- transaction table ----------
        const colW = { date: 62, type: 56, category: 108, amount: 82 };
        const descW = contentW - colW.date - colW.type - colW.category - colW.amount;
        const x0 = MARGIN;
        const xType = x0 + colW.date;
        const xCat = xType + colW.type;
        const xDesc = xCat + colW.category;
        const xAmt = xDesc + descW;
        const PAD = 6;

        const tableHeader = (at: number) => {
            doc.rect(x0, at, contentW, ROW_H).fill(SAGE);
            doc.font("bold").fontSize(9.5).fillColor("#ffffff");
            const ty = at + (ROW_H - doc.currentLineHeight()) / 2;
            line(t("csv.date"), x0 + PAD, ty, colW.date - PAD);
            line(t("csv.type"), xType + PAD, ty, colW.type - PAD);
            line(t("csv.category"), xCat + PAD, ty, colW.category - PAD);
            line(t("csv.description"), xDesc + PAD, ty, descW - PAD);
            line(t("csv.amount"), xAmt, ty, colW.amount - PAD, { align: "right" });
        };

        doc.font("bold").fontSize(12).fillColor(INK);
        line(t("export.transactions"), MARGIN, y, contentW);
        y += 22;

        const rows = data.rows.slice(0, MAX_PDF_ROWS);

        if (rows.length === 0) {
            doc.font("body").fontSize(11).fillColor(MUTED);
            line(t("export.noTransactions"), MARGIN, y + 20, contentW, { align: "center" });
        } else {
            tableHeader(y);
            y += ROW_H;

            rows.forEach((r, i) => {
                if (y + ROW_H > H - 56) {
                    doc.addPage();
                    y = MARGIN;
                    tableHeader(y);
                    y += ROW_H;
                }
                if (i % 2 === 1) doc.rect(x0, y, contentW, ROW_H).fill(STRIPE);
                doc.moveTo(x0, y + ROW_H).lineTo(x0 + contentW, y + ROW_H).lineWidth(0.5).strokeColor(LINE).stroke();

                doc.font("body").fontSize(9.5).fillColor(INK);
                const ty = y + (ROW_H - doc.currentLineHeight()) / 2;
                line(r.date, x0 + PAD, ty, colW.date - PAD);
                doc.fillColor(r.type === "income" ? INCOME : EXPENSE);
                line(r.typeLabel, xType + PAD, ty, colW.type - PAD);
                doc.fillColor(INK);
                line(r.categoryLabel, xCat + PAD, ty, colW.category - PAD);
                line(r.description, xDesc + PAD, ty, descW - PAD);
                doc.font("bold").fillColor(r.type === "income" ? INCOME : EXPENSE);
                line(`${r.type === "income" ? "+" : "-"}${number.format(r.amount)}`, xAmt, ty, colW.amount - PAD, {
                    align: "right",
                });
                y += ROW_H;
            });

            if (data.truncated || data.rows.length > rows.length) {
                y += 8;
                doc.font("body").fontSize(9).fillColor(MUTED);
                line(t("export.truncated", { n: rows.length }), MARGIN, y, contentW);
            }
        }

        // ---------- footer on every page ----------
        const generated = data.generatedAt.toLocaleString(data.lang === "th" ? "th-TH" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Bangkok",
        });
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(range.start + i);
            doc.page.margins.bottom = 0; // otherwise writing near the bottom edge would add a page
            doc.font("body").fontSize(8.5).fillColor(MUTED);
            line(`MoneyPixel · ${t("export.generated", { date: generated })}`, MARGIN, H - 32, contentW * 0.7);
            line(`${i + 1} / ${range.count}`, W - MARGIN - 80, H - 32, 80, { align: "right" });
        }

        doc.end();
    });
}