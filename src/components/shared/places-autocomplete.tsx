"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"

/** Shape returned by the Places Autocomplete (New) API */
interface AutocompleteSuggestion {
  placePrediction: {
    placeId: string
    text: { text: string }
    structuredFormat?: {
      mainText: { text: string }
      secondaryText?: { text: string }
    }
  }
}

/** Result emitted via onPlaceSelect after fetching Place Details */
export interface PlaceSelectResult {
  name: string
  formatted_address: string
  lat: number
  lng: number
  place_id: string
  phone?: string
}

interface PlacesAutocompleteProps {
  onPlaceSelect: (place: PlaceSelectResult) => void
  defaultValue?: string
  placeholder?: string
}

const DEBOUNCE_MS = 300
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

/**
 * Client-side Places Autocomplete using the Google Places API (New) REST endpoints.
 * Does NOT use the JavaScript SDK -- calls the REST API directly with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * Location bias: Zurich area (47.37, 8.55), 50km radius.
 * Region: Switzerland only.
 */
export function PlacesAutocomplete({
  onPlaceSelect,
  defaultValue = "",
  placeholder = "Adresse oder Einrichtung suchen...",
}: PlacesAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!API_KEY) {
      setError("Google Maps API Key nicht konfiguriert")
      return
    }
    if (input.length < 3) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
          },
          body: JSON.stringify({
            input,
            locationBias: {
              circle: {
                center: { latitude: 47.37, longitude: 8.55 },
                radius: 50000,
              },
            },
            includedRegionCodes: ["ch"],
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Places API returned ${response.status}`)
      }

      const data = (await response.json()) as {
        suggestions?: AutocompleteSuggestion[]
      }

      setSuggestions(data.suggestions ?? [])
      setIsOpen((data.suggestions ?? []).length > 0)
      setHighlightedIndex(-1)
    } catch (err: unknown) {
      console.error("Places Autocomplete error:", err)
      setError("Suche fehlgeschlagen")
      setSuggestions([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handleInputChange(value: string): void {
    setQuery(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value)
    }, DEBOUNCE_MS)
  }

  async function handleSelect(suggestion: AutocompleteSuggestion): Promise<void> {
    const placeId = suggestion.placePrediction.placeId
    const displayText = suggestion.placePrediction.text.text

    setQuery(displayText)
    setIsOpen(false)
    setSuggestions([])

    // Fetch Place Details for coordinates and structured data
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?` +
          `fields=displayName,formattedAddress,location,nationalPhoneNumber`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Place Details returned ${response.status}`)
      }

      const details = (await response.json()) as {
        displayName?: { text: string }
        formattedAddress?: string
        location?: { latitude: number; longitude: number }
        nationalPhoneNumber?: string
      }

      if (!details.location) {
        setError("Keine Koordinaten fuer diesen Ort verfuegbar")
        return
      }

      onPlaceSelect({
        name: details.displayName?.text ?? displayText,
        formatted_address: details.formattedAddress ?? displayText,
        lat: details.location.latitude,
        lng: details.location.longitude,
        place_id: placeId,
        phone: details.nationalPhoneNumber ?? undefined,
      })
    } catch (err: unknown) {
      console.error("Place Details error:", err)
      setError("Details konnten nicht geladen werden")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      const selected = suggestions[highlightedIndex]
      if (selected) {
        void handleSelect(selected)
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true)
        }}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {suggestions.map((suggestion, index) => {
            const prediction = suggestion.placePrediction
            const mainText =
              prediction.structuredFormat?.mainText.text ?? prediction.text.text
            const secondaryText =
              prediction.structuredFormat?.secondaryText?.text

            return (
              <li
                key={prediction.placeId}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  // Prevent input blur before selection
                  e.preventDefault()
                  void handleSelect(suggestion)
                }}
              >
                <span className="font-medium">{mainText}</span>
                {secondaryText && (
                  <span className="ml-1 text-muted-foreground">
                    {secondaryText}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
