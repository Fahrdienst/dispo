import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Complete data structure for the order sheet email template.
 * Assembled from rides, patients, destinations, drivers, and patient_impairments.
 */
export interface OrderSheetData {
  // Ride
  rideId: string
  date: string
  pickupTime: string
  appointmentTime: string | null
  returnPickupTime: string | null
  direction: string // ride_direction enum value
  status: string // ride_status enum value
  notes: string | null
  distanceKm: number | null
  effectivePrice: number | null
  isPriceOverride: boolean

  // Patient
  patientFirstName: string
  patientLastName: string
  patientStreet: string | null
  patientHouseNumber: string | null
  patientPostalCode: string | null
  patientCity: string | null
  patientPhone: string | null
  patientComment: string | null
  patientEmergencyName: string | null
  patientEmergencyPhone: string | null
  patientImpairments: string[] // impairment_type values

  // Destination
  destinationName: string
  destinationFacilityType: string | null
  destinationStreet: string | null
  destinationHouseNumber: string | null
  destinationPostalCode: string | null
  destinationCity: string | null
  destinationPhone: string | null
  destinationContactFirstName: string | null
  destinationContactLastName: string | null
  destinationDepartment: string | null
  destinationComment: string | null

  // Driver
  driverFirstName: string
  driverLastName: string
  driverStreet: string | null
  driverHouseNumber: string | null
  driverPostalCode: string | null
  driverCity: string | null
  driverPhone: string | null
  driverEmail: string | null
  driverVehicleType: string

  // Actions (token URLs)
  confirmUrl: string
  rejectUrl: string
}

// Type aliases for Supabase join results
interface RideWithJoins {
  id: string
  date: string
  pickup_time: string
  appointment_time: string | null
  return_pickup_time: string | null
  direction: string
  status: string
  notes: string | null
  distance_meters: number | null
  calculated_price: number | null
  price_override: number | null
  patients: {
    first_name: string
    last_name: string
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
    phone: string | null
    comment: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
  }
  destinations: {
    display_name: string
    facility_type: string | null
    street: string | null
    house_number: string | null
    postal_code: string | null
    city: string | null
    contact_phone: string | null
    contact_first_name: string | null
    contact_last_name: string | null
    department: string | null
    comment: string | null
  }
}

interface DriverRow {
  first_name: string
  last_name: string
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
  phone: string | null
  email: string | null
  vehicle_type: string
}

/**
 * Load all data needed for the order sheet email.
 * Uses the admin client (service role) to bypass RLS, consistent with
 * other mail functions that run in background/cron contexts.
 *
 * @throws Error if ride or driver is not found
 */
export async function loadOrderSheetData(
  rideId: string,
  driverId: string,
  confirmUrl: string,
  rejectUrl: string
): Promise<OrderSheetData> {
  const supabase = createAdminClient()

  // Load ride with patient and destination joins
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select(`
      id, date, pickup_time, appointment_time, return_pickup_time,
      direction, status, notes, distance_meters,
      calculated_price, price_override, patient_id,
      patients!inner(
        first_name, last_name, street, house_number,
        postal_code, city, phone, comment,
        emergency_contact_name, emergency_contact_phone
      ),
      destinations!inner(
        display_name, facility_type, street, house_number,
        postal_code, city, contact_phone,
        contact_first_name, contact_last_name,
        department, comment
      )
    `)
    .eq("id", rideId)
    .single()

  if (rideError || !ride) {
    throw new Error(`Failed to load ride ${rideId}: ${rideError?.message ?? "not found"}`)
  }

  // Load driver
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select(`
      first_name, last_name, street, house_number,
      postal_code, city, phone, email, vehicle_type
    `)
    .eq("id", driverId)
    .single()

  if (driverError || !driver) {
    throw new Error(`Failed to load driver ${driverId}: ${driverError?.message ?? "not found"}`)
  }

  // Cast join results to typed aliases
  const patient = (ride as unknown as RideWithJoins).patients
  const destination = (ride as unknown as RideWithJoins).destinations
  const driverData = driver as DriverRow

  // Load patient impairments (separate query — junction table)
  const { data: impairmentRows } = await supabase
    .from("patient_impairments")
    .select("impairment_type")
    .eq("patient_id", ride.patient_id)

  const impairments = (impairmentRows ?? []).map((row) => row.impairment_type)

  // Compute effective price: price_override takes precedence over calculated_price
  const priceOverride = ride.price_override
  const calculatedPrice = ride.calculated_price
  const effectivePrice = priceOverride ?? calculatedPrice
  const isPriceOverride = priceOverride !== null

  // Convert distance_meters to km (nullable)
  const distanceKm = ride.distance_meters !== null
    ? Math.round((ride.distance_meters / 1000) * 10) / 10
    : null

  return {
    // Ride
    rideId: ride.id,
    date: ride.date,
    pickupTime: ride.pickup_time,
    appointmentTime: ride.appointment_time,
    returnPickupTime: ride.return_pickup_time,
    direction: ride.direction,
    status: ride.status,
    notes: ride.notes,
    distanceKm,
    effectivePrice,
    isPriceOverride,

    // Patient
    patientFirstName: patient.first_name,
    patientLastName: patient.last_name,
    patientStreet: patient.street,
    patientHouseNumber: patient.house_number,
    patientPostalCode: patient.postal_code,
    patientCity: patient.city,
    patientPhone: patient.phone,
    patientComment: patient.comment,
    patientEmergencyName: patient.emergency_contact_name,
    patientEmergencyPhone: patient.emergency_contact_phone,
    patientImpairments: impairments,

    // Destination
    destinationName: destination.display_name,
    destinationFacilityType: destination.facility_type,
    destinationStreet: destination.street,
    destinationHouseNumber: destination.house_number,
    destinationPostalCode: destination.postal_code,
    destinationCity: destination.city,
    destinationPhone: destination.contact_phone,
    destinationContactFirstName: destination.contact_first_name,
    destinationContactLastName: destination.contact_last_name,
    destinationDepartment: destination.department,
    destinationComment: destination.comment,

    // Driver
    driverFirstName: driverData.first_name,
    driverLastName: driverData.last_name,
    driverStreet: driverData.street,
    driverHouseNumber: driverData.house_number,
    driverPostalCode: driverData.postal_code,
    driverCity: driverData.city,
    driverPhone: driverData.phone,
    driverEmail: driverData.email,
    driverVehicleType: driverData.vehicle_type,

    // Actions
    confirmUrl,
    rejectUrl,
  }
}
