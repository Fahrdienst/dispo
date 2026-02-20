"use client"

import { useFormState } from "react-dom"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/shared/submit-button"
import { createFareRule, deleteFareRule } from "@/actions/fares"
import type { Tables } from "@/lib/types/database"

interface FareRuleWithZones extends Tables<"fare_rules"> {
  from_zone: Tables<"zones">
  to_zone: Tables<"zones">
}

interface FareRulesManagerProps {
  fareVersionId: string
  rules: FareRuleWithZones[]
  zones: Tables<"zones">[]
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value)
}

export function FareRulesManager({
  fareVersionId,
  rules,
  zones,
}: FareRulesManagerProps) {
  const addAction = createFareRule.bind(null, fareVersionId)
  const [addState, addFormAction] = useFormState(addAction, null)
  const [isPending, startTransition] = useTransition()

  const addFieldErrors =
    addState && !addState.success ? addState.fieldErrors : undefined

  function handleDelete(ruleId: string) {
    if (!confirm("Tarifregel wirklich loeschen?")) return
    startTransition(async () => {
      await deleteFareRule(ruleId)
    })
  }

  const activeZones = zones.filter((z) => z.is_active)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarifregeln</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add rule form */}
        <form action={addFormAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from_zone_id">Von Zone</Label>
              <Select name="from_zone_id">
                <SelectTrigger>
                  <SelectValue placeholder="Zone waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {activeZones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addFieldErrors?.from_zone_id && (
                <p className="text-sm text-destructive">
                  {addFieldErrors.from_zone_id[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_zone_id">Nach Zone</Label>
              <Select name="to_zone_id">
                <SelectTrigger>
                  <SelectValue placeholder="Zone waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {activeZones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addFieldErrors?.to_zone_id && (
                <p className="text-sm text-destructive">
                  {addFieldErrors.to_zone_id[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="base_price">Grundpreis (CHF)</Label>
              <Input
                id="base_price"
                name="base_price"
                type="number"
                step="0.05"
                min="0"
                placeholder="0.00"
              />
              {addFieldErrors?.base_price && (
                <p className="text-sm text-destructive">
                  {addFieldErrors.base_price[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_per_km">Preis pro km (CHF)</Label>
              <Input
                id="price_per_km"
                name="price_per_km"
                type="number"
                step="0.05"
                min="0"
                placeholder="0.00"
              />
              {addFieldErrors?.price_per_km && (
                <p className="text-sm text-destructive">
                  {addFieldErrors.price_per_km[0]}
                </p>
              )}
            </div>
          </div>

          {addState && !addState.success && addState.error && (
            <p className="text-sm text-destructive">{addState.error}</p>
          )}
          {addState && addState.success && (
            <p className="text-sm text-green-600">Tarifregel hinzugefuegt.</p>
          )}

          <SubmitButton>Regel hinzufuegen</SubmitButton>
        </form>

        {/* Rules table */}
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Tarifregeln definiert. Fuegen Sie oben eine Regel hinzu.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Von Zone</TableHead>
                  <TableHead>Nach Zone</TableHead>
                  <TableHead>Grundpreis</TableHead>
                  <TableHead>Preis/km</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.from_zone.name}</TableCell>
                    <TableCell>{rule.to_zone.name}</TableCell>
                    <TableCell>{formatPrice(rule.base_price)}</TableCell>
                    <TableCell>{formatPrice(rule.price_per_km)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(rule.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Loeschen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
