import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ScreenshotMarker } from "@/lib/help/types"

interface HelpScreenshotProps {
  src: string
  alt: string
  caption?: string
  markers?: ScreenshotMarker[]
  className?: string
}

/**
 * Renders an annotated screenshot with optional numbered marker overlays.
 *
 * Images live under `/public/help/screenshots/`. Placeholder paths are fine:
 * a missing file simply shows nothing until the real image is added.
 *
 * Markers are positioned by percentage so they stay correct at any size.
 * Server component — no interactivity required.
 */
export function HelpScreenshot({
  src,
  alt,
  caption,
  markers,
  className,
}: HelpScreenshotProps): React.ReactElement {
  return (
    <figure className={cn("my-6", className)}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-contain"
        />
        {markers?.map((marker) => (
          <span
            key={marker.number}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary text-sm font-bold text-primary-foreground shadow-md"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            aria-hidden="true"
          >
            {marker.number}
          </span>
        ))}
      </div>

      {(caption || (markers && markers.length > 0)) && (
        <figcaption className="mt-3 space-y-2 text-base text-slate-600">
          {caption && <p>{caption}</p>}
          {markers && markers.some((marker) => marker.label) && (
            <ol className="space-y-1">
              {markers
                .filter((marker) => marker.label)
                .map((marker) => (
                  <li key={marker.number} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {marker.number}
                    </span>
                    <span>{marker.label}</span>
                  </li>
                ))}
            </ol>
          )}
        </figcaption>
      )}
    </figure>
  )
}
