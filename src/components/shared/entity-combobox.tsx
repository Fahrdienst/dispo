"use client"

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"

export interface ComboboxItem {
  id: string
  label: string
  sublabel?: string
}

interface EntityComboboxProps {
  items: ComboboxItem[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  emptyMessage?: string
  onCreateNew?: () => void
  /** Auto-focus this input on mount */
  autoFocus?: boolean
  /** HTML name attribute for hidden input (form integration) */
  name?: string
  /** aria-label for accessibility */
  "aria-label"?: string
}

/**
 * Normalize a string for fuzzy matching:
 * - lowercased
 * - common German umlaut equivalences (ue->u, ae->a, oe->o, ss->s)
 * - strip diacritics via NFD + regex
 */
function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Check if the query tokens all appear in the target string (order-independent).
 * This handles "muel" matching "Mueller" and "Hans Muel" matching "Mueller, Hans".
 */
function fuzzyMatch(query: string, target: string): boolean {
  const normalizedTarget = normalizeForSearch(target)
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  return tokens.every((token) => normalizedTarget.includes(token))
}

export function EntityCombobox({
  items,
  value,
  onChange,
  placeholder = "Suchen...",
  emptyMessage = "Keine Ergebnisse",
  onCreateNew,
  autoFocus = false,
  name,
  "aria-label": ariaLabel,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce the search query (150ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Filtered items based on debounced query
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return items
    return items.filter(
      (item) =>
        fuzzyMatch(debouncedQuery, item.label) ||
        (item.sublabel && fuzzyMatch(debouncedQuery, item.sublabel))
    )
  }, [items, debouncedQuery])

  // Reset highlight when filtered items change
  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const highlighted = listRef.current.children[highlightIndex] as
      | HTMLElement
      | undefined
    highlighted?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, open])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Find the currently selected item for display
  const selectedItem = useMemo(
    () => items.find((item) => item.id === value) ?? null,
    [items, value]
  )

  const selectItem = useCallback(
    (item: ComboboxItem) => {
      onChange(item.id)
      setQuery("")
      setDebouncedQuery("")
      setOpen(false)
      inputRef.current?.blur()
    },
    [onChange]
  )

  const clearSelection = useCallback(() => {
    onChange(null)
    setQuery("")
    setDebouncedQuery("")
    // Re-focus the input after clearing
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [onChange])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault()
          setOpen(true)
          return
        }
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightIndex((prev) => {
            const max = filtered.length + (onCreateNew ? 1 : 0) - 1
            return prev < max ? prev + 1 : 0
          })
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightIndex((prev) => {
            const max = filtered.length + (onCreateNew ? 1 : 0) - 1
            return prev > 0 ? prev - 1 : max
          })
          break
        case "Enter":
          e.preventDefault()
          if (
            onCreateNew &&
            highlightIndex === filtered.length
          ) {
            onCreateNew()
            setOpen(false)
          } else {
            const item = filtered[highlightIndex]
            if (item) selectItem(item)
          }
          break
        case "Escape":
          e.preventDefault()
          setOpen(false)
          inputRef.current?.blur()
          break
        case "Tab":
          setOpen(false)
          break
      }
    },
    [open, filtered, highlightIndex, onCreateNew, selectItem]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      if (!open) setOpen(true)
      setHighlightIndex(0)
    },
    [open]
  )

  const handleFocus = useCallback(() => {
    setOpen(true)
    // If there is a selected value and no query, show all items
    if (value && !query) {
      setQuery("")
    }
  }, [value, query])

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[highlightIndex]
              ? `combobox-option-${filtered[highlightIndex].id}`
              : undefined
          }
          autoFocus={autoFocus}
          className={cn(
            "flex h-11 w-full rounded-xl border border-input bg-white/90 px-3 py-2 pr-16 text-sm shadow-sm backdrop-blur",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          placeholder={
            selectedItem ? selectedItem.label : placeholder
          }
          value={open ? query : selectedItem ? selectedItem.label : query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {value && (
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Auswahl entfernen"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(!open)
              if (!open) inputRef.current?.focus()
            }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label="Dropdown oeffnen"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {filtered.length === 0 && !onCreateNew && (
            <li className="px-3 py-3 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </li>
          )}
          {filtered.map((item, index) => (
            <li
              key={item.id}
              id={`combobox-option-${item.id}`}
              role="option"
              aria-selected={item.id === value}
              className={cn(
                "flex cursor-pointer flex-col px-3 py-2.5 text-sm transition-colors",
                "min-h-[44px] justify-center",
                highlightIndex === index && "bg-accent text-accent-foreground",
                item.id === value &&
                  highlightIndex !== index &&
                  "bg-primary/5 font-medium"
              )}
              onMouseEnter={() => setHighlightIndex(index)}
              onMouseDown={(e) => {
                // Prevent input blur before selection
                e.preventDefault()
                selectItem(item)
              }}
            >
              <span className="truncate">{item.label}</span>
              {item.sublabel && (
                <span className="truncate text-xs text-muted-foreground">
                  {item.sublabel}
                </span>
              )}
            </li>
          ))}
          {onCreateNew && (
            <li
              role="option"
              aria-selected={false}
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center gap-2 border-t px-3 py-2.5 text-sm font-medium text-primary transition-colors",
                highlightIndex === filtered.length &&
                  "bg-accent text-accent-foreground"
              )}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
              onMouseDown={(e) => {
                e.preventDefault()
                onCreateNew()
                setOpen(false)
              }}
            >
              + Neu anlegen
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
