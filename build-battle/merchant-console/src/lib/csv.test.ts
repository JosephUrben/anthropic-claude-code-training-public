import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  parseExportColumns,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("parseExportColumns", () => {
  /** Parse as the route does, then serialize with whatever came back. */
  const exportWith = (raw: string | null) => {
    const parsed = parseExportColumns(raw)
    if (!parsed.ok) throw new Error(parsed.error)
    return toCsv([payment], parsed.columns).split("\n")
  }

  it("writes a subset of columns in the order requested, not the table's order", () => {
    expect(exportWith("amount,id,status")).toEqual([
      "amount,id,status",
      "$250.00,pay_0001,captured",
    ])
  })

  it("leaves the card last four out when no columns are named", () => {
    const [header, row] = exportWith(null)
    expect(header.split(",")).not.toContain("last4")
    expect(header).toBe(DEFAULT_EXPORT_COLUMNS.join(","))
    expect(row).not.toContain("4242")
  })

  it("keeps every other column in the default, so last four is the only one dropped", () => {
    expect(
      EXPORT_COLUMNS.filter((c) => !DEFAULT_EXPORT_COLUMNS.includes(c)),
    ).toEqual<ExportColumn[]>(["last4"])
  })

  it("includes the last four only when it is asked for", () => {
    expect(exportWith("id,last4")).toEqual(["id,last4", "pay_0001,4242"])
  })

  it("rejects an empty selection rather than writing an empty file", () => {
    for (const raw of ["", ",", " , "]) {
      expect(parseExportColumns(raw)).toEqual({
        ok: false,
        error: "Choose at least one column.",
      })
    }
  })

  it("rejects a column that is not on the allowlist, even beside valid ones", () => {
    const parsed = parseExportColumns("id,password")
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain("password")
  })

  it("drops repeated columns and trims whitespace", () => {
    expect(parseExportColumns(" id , amount,id ")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope ahead of the date when given one", () => {
    expect(
      exportFilename(new Date("2026-08-13T09:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })
})
