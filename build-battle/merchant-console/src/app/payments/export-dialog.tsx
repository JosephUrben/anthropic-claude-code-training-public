"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "filter" | "all"

/**
 * Export options for the payments table. The browser only chooses; the file
 * is built by GET /api/payments/export, which re-validates every choice and
 * exports every matching row, not the page on screen.
 */
export function ExportDialog({
  query,
  counts,
  columns,
  defaultColumns,
}: {
  /** The table's current filter, as a query string. */
  query: string
  counts: Record<Scope, number>
  columns: { id: ExportColumn; label: string }[]
  defaultColumns: readonly ExportColumn[]
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filter")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(defaultColumns),
  )

  const toggle = (column: ExportColumn) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Keep the table's column order rather than the order things were clicked.
  const chosen = columns.map((c) => c.id).filter((id) => selected.has(id))

  const href = (() => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", chosen.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  const scopes: { id: Scope; label: string }[] = [
    { id: "filter", label: "Current filter" },
    { id: "all", label: "All payments" },
  ]

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Download a CSV of the payments you choose.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Payments
            </legend>
            {scopes.map((option) => (
              <label
                key={option.id}
                htmlFor={`export-scope-${option.id}`}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 dark:border-gray-800"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`export-scope-${option.id}`}
                    name="export-scope"
                    value={option.id}
                    checked={scope === option.id}
                    onChange={() => setScope(option.id)}
                    className="size-4 accent-blue-500"
                  />
                  <span className="text-gray-900 dark:text-gray-50">{option.label}</span>
                </span>
                <span className="tabular-nums text-gray-500">
                  {counts[option.id].toLocaleString()}{" "}
                  {counts[option.id] === 1 ? "row" : "rows"}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {columns.map((column) => (
                <label
                  key={column.id}
                  htmlFor={`export-column-${column.id}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="checkbox"
                    id={`export-column-${column.id}`}
                    checked={selected.has(column.id)}
                    onChange={() => toggle(column.id)}
                    className="size-4 accent-blue-500"
                  />
                  {column.label}
                </label>
              ))}
            </div>
            {chosen.length === 0 && (
              <p role="status" className="text-sm text-gray-500">
                Choose at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          {chosen.length === 0 ? (
            <Button variant="primary" disabled>
              Download CSV
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
