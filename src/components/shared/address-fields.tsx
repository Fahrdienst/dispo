import type { ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddressFieldsProps {
  defaultValues?: {
    street?: string | null
    house_number?: string | null
    postal_code?: string | null
    city?: string | null
  }
  values?: {
    street?: string
    house_number?: string
    postal_code?: string
    city?: string
  }
  onChange?: (field: string, value: string) => void
  errors?: Record<string, string[] | undefined>
  required?: boolean
  /** Optional prefix for HTML id attributes to avoid collisions in dialogs */
  idPrefix?: string
}

export function AddressFields({ 
  defaultValues, 
  values,
  onChange,
  errors, 
  required, 
  idPrefix 
}: AddressFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}_` : ""

  // Controlled mode requires an onChange handler. Without it, a `value` prop
  // would freeze the input (no state update on keystroke). In that case we
  // fall back to `defaultValue` so native, uncontrolled editing works.
  const controlled = typeof onChange === "function"

  const fieldProps = (
    field: keyof NonNullable<AddressFieldsProps["values"]>
  ) => {
    if (controlled) {
      return {
        value: values?.[field] ?? defaultValues?.[field] ?? "",
        onChange: (e: ChangeEvent<HTMLInputElement>) =>
          onChange?.(field, e.target.value),
      }
    }
    return { defaultValue: defaultValues?.[field] ?? "" }
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">Adresse</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-3 space-y-2">
          <Label htmlFor={`${prefix}street`}>
            Strasse{required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${prefix}street`}
            name="street"
            required={required}
            {...fieldProps("street")}
          />
          {errors?.street && (
            <p className="text-sm text-destructive">{errors.street[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}house_number`}>
            Hausnr.{required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${prefix}house_number`}
            name="house_number"
            required={required}
            {...fieldProps("house_number")}
          />
          {errors?.house_number && (
            <p className="text-sm text-destructive">
              {errors.house_number[0]}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}postal_code`}>
            PLZ{required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${prefix}postal_code`}
            name="postal_code"
            required={required}
            {...fieldProps("postal_code")}
          />
          {errors?.postal_code && (
            <p className="text-sm text-destructive">{errors.postal_code[0]}</p>
          )}
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor={`${prefix}city`}>
            Ort{required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${prefix}city`}
            name="city"
            required={required}
            {...fieldProps("city")}
          />
          {errors?.city && (
            <p className="text-sm text-destructive">{errors.city[0]}</p>
          )}
        </div>
      </div>
    </fieldset>
  )
}
