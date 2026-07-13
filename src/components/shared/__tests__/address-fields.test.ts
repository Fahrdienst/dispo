import { createElement, isValidElement, type ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { AddressFields } from "../address-fields"

/**
 * Regression test for issue #89: address fields (street, house number,
 * postal code, city) could not be filled when creating a new driver.
 *
 * Root cause: AddressFields always rendered a controlled `value` prop paired
 * with an onChange that called the (undefined) parent `onChange?.()`. When a
 * parent used the component without an onChange handler (the driver form),
 * every keystroke was a no-op and the inputs were frozen.
 *
 * The fix makes the component uncontrolled when no onChange is supplied: it
 * renders `defaultValue` (and no `value`) so the DOM owns the input state.
 * These tests inspect the rendered element tree to assert that contract.
 */

/** Collect the four address <Input> elements keyed by their `name` prop. */
function collectInputs(node: unknown, acc: Record<string, Record<string, unknown>> = {}) {
  if (Array.isArray(node)) {
    node.forEach((c) => collectInputs(c, acc))
    return acc
  }
  if (!isValidElement(node)) return acc
  const el = node as ReactElement<Record<string, unknown>>
  const name = el.props?.name
  if (typeof name === "string" && ["street", "house_number", "postal_code", "city"].includes(name)) {
    acc[name] = el.props
  }
  if (el.props?.children) collectInputs(el.props.children, acc)
  return acc
}

const FIELDS = ["street", "house_number", "postal_code", "city"]

describe("AddressFields", () => {
  it("is uncontrolled (defaultValue, no frozen value) when no onChange is provided", () => {
    const tree = AddressFields({
      required: true,
      defaultValues: { street: "Bahnhofstrasse", house_number: "12", postal_code: "8600", city: "Dübendorf" },
    })

    const inputs = collectInputs(tree)
    expect(Object.keys(inputs).sort()).toEqual([...FIELDS].sort())

    for (const name of FIELDS) {
      const props = inputs[name]
      // Must NOT be a controlled input, otherwise the field freezes (issue #89).
      expect(props).not.toHaveProperty("value")
      expect(props).not.toHaveProperty("onChange")
      expect(props).toHaveProperty("defaultValue")
    }
    expect(inputs.street.defaultValue).toBe("Bahnhofstrasse")
    expect(inputs.city.defaultValue).toBe("Dübendorf")
  })

  it("stays controlled (value + onChange) when an onChange handler is provided", () => {
    const tree = AddressFields({
      required: true,
      values: { street: "Seestrasse", house_number: "5", postal_code: "8610", city: "Uster" },
      onChange: () => {},
    })

    const inputs = collectInputs(tree)
    for (const name of FIELDS) {
      const props = inputs[name]
      expect(props).toHaveProperty("value")
      expect(typeof props.onChange).toBe("function")
      expect(props).not.toHaveProperty("defaultValue")
    }
    expect(inputs.street.value).toBe("Seestrasse")
  })
})
