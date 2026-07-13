import { cn } from "@/lib/utils"
import { Info, Lightbulb, TriangleAlert } from "lucide-react"
import type {
  CalloutBlock,
  HelpArticle,
  HelpBlock,
  ListBlock,
  ParagraphBlock,
  StepsBlock,
} from "@/lib/help/types"
import { HelpScreenshot } from "@/components/help/help-screenshot"
import { HelpToc, type TocItem } from "@/components/help/help-toc"

interface HelpArticleProps {
  article: HelpArticle
  /** Optional slot rendered next to the title (e.g. a bookmark toggle). */
  headerAction?: React.ReactNode
}

const CALLOUT_STYLES: Record<
  CalloutBlock["variant"],
  { container: string; icon: React.ReactNode; label: string }
> = {
  info: {
    container: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <Info className="h-5 w-5 flex-shrink-0 text-sky-600" aria-hidden />,
    label: "Hinweis",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    icon: (
      <TriangleAlert
        className="h-5 w-5 flex-shrink-0 text-amber-600"
        aria-hidden
      />
    ),
    label: "Achtung",
  },
  tip: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: (
      <Lightbulb className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden />
    ),
    label: "Tipp",
  },
}

function Paragraph({ block }: { block: ParagraphBlock }): React.ReactElement {
  return <p className="leading-relaxed text-slate-700">{block.text}</p>
}

function List({ block }: { block: ListBlock }): React.ReactElement {
  const className = cn(
    "space-y-2 pl-6 text-slate-700 marker:text-slate-400",
    block.ordered ? "list-decimal" : "list-disc"
  )
  const items = block.items.map((item, index) => (
    <li key={index} className="leading-relaxed">
      {item}
    </li>
  ))
  return block.ordered ? (
    <ol className={className}>{items}</ol>
  ) : (
    <ul className={className}>{items}</ul>
  )
}

function Callout({ block }: { block: CalloutBlock }): React.ReactElement {
  const style = CALLOUT_STYLES[block.variant]
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4", style.container)}>
      {style.icon}
      <div className="space-y-1">
        <p className="font-semibold">{block.title ?? style.label}</p>
        <p className="leading-relaxed">{block.text}</p>
      </div>
    </div>
  )
}

function Steps({ block }: { block: StepsBlock }): React.ReactElement {
  return (
    <ol className="space-y-4">
      {block.steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="space-y-1 pt-1">
            <p className="font-semibold text-slate-900">{step.title}</p>
            <p className="leading-relaxed text-slate-700">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Renders a single block. Switches exhaustively over the discriminated union;
 * the `never` default guarantees every block type is handled at compile time.
 */
function Block({ block }: { block: HelpBlock }): React.ReactElement {
  switch (block.type) {
    case "paragraph":
      return <Paragraph block={block} />
    case "list":
      return <List block={block} />
    case "screenshot":
      return (
        <HelpScreenshot
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          markers={block.markers}
        />
      )
    case "callout":
      return <Callout block={block} />
    case "steps":
      return <Steps block={block} />
    default: {
      const exhaustiveCheck: never = block
      return exhaustiveCheck
    }
  }
}

/**
 * Renders a complete help article: title, summary, and all sections with a
 * sticky table of contents. Server component; the only client part is the
 * TOC scroll-spy.
 */
export function HelpArticle({
  article,
  headerAction,
}: HelpArticleProps): React.ReactElement {
  const tocItems: TocItem[] = article.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
  }))

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-12">
      <article className="help-prose min-w-0">
        <header className="mb-8 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {article.title}
            </h1>
            {headerAction}
          </div>
          <p className="text-lg text-slate-600">{article.summary}</p>
        </header>

        <div className="space-y-12">
          {article.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 space-y-4"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {section.heading}
              </h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}
        </div>
      </article>

      <HelpToc items={tocItems} />
    </div>
  )
}
