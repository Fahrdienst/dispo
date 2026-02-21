import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddressFieldsProps {
  defaultValues?: {
    street?: string | null
    house_number?: string | null
    postal_code?: string | null
    city?: string | null
  }
  errors?: Record<string, string[] | undefined>
  required?: boolean
  /** Optional prefix for HTML id attributes to avoid collisions in dialogs */
  idPrefix?: string
}

export function AddressFields({ defaultValues, errors, required, idPrefix }: AddressFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}_` : ""

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
            defaultValue={defaultValues?.street ?? ""}
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
            defaultValue={defaultValues?.house_number ?? ""}
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
            defaultValue={defaultValues?.postal_code ?? ""}
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
            defaultValue={defaultValues?.city ?? ""}
          />
          {errors?.city && (
            <p className="text-sm text-destructive">{errors.city[0]}</p>
          )}
        </div>
      </div>
    </fieldset>
  )
}
