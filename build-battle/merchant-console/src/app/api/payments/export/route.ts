import { merchantById } from "@/data/merchants"
import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

/**
 * Names the file after what is in it. Built from validated values only:
 * the status has been through parseFilters' allowlist and the merchant id
 * must resolve, so free text like the search box never reaches a filename.
 */
function scopeLabel(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  const merchant = filters.merchantId ? merchantById(filters.merchantId) : null
  if (merchant) parts.push(merchant.id)
  if (parts.length > 0) return parts.join("-")

  const narrowed = filters.search || filters.from || filters.to || filters.merchantId
  return narrowed ? "filtered" : "all"
}

/**
 * Exports the payments table as CSV.
 *
 * `scope` is `filter` (default, the active filters) or `all`. `columns` is a
 * comma list checked against EXPORT_COLUMNS; omitted, it falls back to the
 * defaults, which leave out the card last four. Both go through the same
 * query builder as GET /api/payments and skip pagination, so the file holds
 * every matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return badRequest(`Scope must be "filter" or "all".`)
  }

  const columns = parseExportColumns(params.get("columns"))
  if (!columns.ok) return badRequest(columns.error)

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), scopeLabel(scope as Scope, filters))
  return new Response(toCsv(rows, columns.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
