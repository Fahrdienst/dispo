import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  default: "",
  warning: "border-amber-200 bg-amber-50/40",
  critical: "border-red-200 bg-red-50/40",
  success: "border-green-200 bg-green-50/40",
} as const;

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  variant?: "default" | "warning" | "critical" | "success";
  /** Additional class for the value text (e.g. conditional color) */
  valueClassName?: string;
  subtitle?: string;
  subtitleValue?: string | number;
  subtitleColorClass?: string;
  /** Optional custom content below the value – use for complex layouts like multiple subtitle rows */
  children?: ReactNode;
  href?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  variant = "default",
  valueClassName,
  subtitle,
  subtitleValue,
  subtitleColorClass,
  children,
  href,
}: StatCardProps): JSX.Element {
  const content = (
    <Card className={cn(VARIANT_CLASSES[variant])}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("rounded-md p-2", iconBgClass)} aria-hidden="true">
          <Icon className={cn("h-4 w-4", iconColorClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold tabular-nums", valueClassName)}>
          {value}
        </p>
        {subtitle !== undefined && subtitleValue !== undefined && (
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">{subtitle}</span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                subtitleColorClass
              )}
            >
              {subtitleValue}
            </span>
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
}
