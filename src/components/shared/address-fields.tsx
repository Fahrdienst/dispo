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
}

export function AddressFields({ defaultValues, errors }: AddressFieldsProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">Adresse</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-3 space-y-2">
          <Label htmlFor="street">Straße</Label>
          <Input
            id="street"
            name="street"
            defaultValue={defaultValues?.street ?? ""}
          />
          {errors?.street && (
            <p className="text-sm text-destructive">{errors.street[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="house_number">Hausnr.</Label>
          <Input
            id="house_number"
            name="house_number"
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
          <Label htmlFor="postal_code">PLZ</Label>
          <Input
            id="postal_code"
            name="postal_code"
            defaultValue={defaultValues?.postal_code ?? ""}
          />
          {errors?.postal_code && (
            <p className="text-sm text-destructive">{errors.postal_code[0]}</p>
          )}
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="city">Stadt</Label>
          <Input
            id="city"
            name="city"
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
