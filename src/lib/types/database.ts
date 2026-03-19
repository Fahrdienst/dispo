export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          user_role: string | null
          action: string
          entity_type: string
          entity_id: string | null
          changes: Json | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_role?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          changes?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          user_role?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          changes?: Json | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      acceptance_tracking: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          is_short_notice: boolean
          notified_at: string
          rejection_reason_code:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          rejection_reason_text: string | null
          reminder_1_at: string | null
          reminder_2_at: string | null
          resolved_at: string | null
          resolved_by: Database["public"]["Enums"]["resolution_method"] | null
          ride_id: string
          stage: Database["public"]["Enums"]["acceptance_stage"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          is_short_notice?: boolean
          notified_at?: string
          rejection_reason_code?:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          rejection_reason_text?: string | null
          reminder_1_at?: string | null
          reminder_2_at?: string | null
          resolved_at?: string | null
          resolved_by?: Database["public"]["Enums"]["resolution_method"] | null
          ride_id: string
          stage?: Database["public"]["Enums"]["acceptance_stage"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          is_short_notice?: boolean
          notified_at?: string
          rejection_reason_code?:
            | Database["public"]["Enums"]["rejection_reason"]
            | null
          rejection_reason_text?: string | null
          reminder_1_at?: string | null
          reminder_2_at?: string | null
          resolved_at?: string | null
          resolved_by?: Database["public"]["Enums"]["resolution_method"] | null
          ride_id?: string
          stage?: Database["public"]["Enums"]["acceptance_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_tracking_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_tracking_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_tokens: {
        Row: {
          action: string | null
          created_at: string
          driver_id: string
          expires_at: string
          id: string
          reminders_sent: number
          ride_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          driver_id: string
          expires_at: string
          id?: string
          reminders_sent?: number
          ride_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          driver_id?: string
          expires_at?: string
          id?: string
          reminders_sent?: number
          ride_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_tokens_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_tokens_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_log: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          ride_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          ride_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          city: string | null
          comment: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          contact_phone: string | null
          created_at: string
          department: string | null
          display_name: string
          facility_type: Database["public"]["Enums"]["facility_type"]
          formatted_address: string | null
          geocode_status: string
          geocode_updated_at: string | null
          house_number: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          place_id: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          comment?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          created_at?: string
          department?: string | null
          display_name: string
          facility_type?: Database["public"]["Enums"]["facility_type"]
          formatted_address?: string | null
          geocode_status?: string
          geocode_updated_at?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          comment?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          created_at?: string
          department?: string | null
          display_name?: string
          facility_type?: Database["public"]["Enums"]["facility_type"]
          formatted_address?: string | null
          geocode_status?: string
          geocode_updated_at?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_availability: {
        Row: {
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"] | null
          driver_id: string
          end_time: string
          id: string
          specific_date: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
          driver_id: string
          end_time: string
          id?: string
          specific_date?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
          driver_id?: string
          end_time?: string
          id?: string
          specific_date?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          city: string | null
          created_at: string
          driving_license: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          house_number: string | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
          vehicle: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          driving_license?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          vehicle?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          city?: string | null
          created_at?: string
          driving_license?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
          vehicle?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      fare_rules: {
        Row: {
          base_price: number
          created_at: string
          fare_version_id: string
          from_zone_id: string
          id: string
          price_per_km: number
          to_zone_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          fare_version_id: string
          from_zone_id: string
          id?: string
          price_per_km?: number
          to_zone_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          fare_version_id?: string
          from_zone_id?: string
          id?: string
          price_per_km?: number
          to_zone_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fare_rules_fare_version_id_fkey"
            columns: ["fare_version_id"]
            isOneToOne: false
            referencedRelation: "fare_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_rules_from_zone_id_fkey"
            columns: ["from_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_rules_to_zone_id_fkey"
            columns: ["to_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      fare_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      mail_log: {
        Row: {
          created_at: string
          driver_id: string | null
          error: string | null
          id: string
          recipient: string
          ride_id: string | null
          status: string
          template: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          error?: string | null
          id?: string
          recipient: string
          ride_id?: string | null
          status?: string
          template: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          error?: string | null
          id?: string
          recipient?: string
          ride_id?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_from_address: string | null
          email_from_name: string | null
          id: string
          logo_url: string | null
          org_city: string | null
          org_country: string | null
          org_email: string | null
          org_name: string
          org_phone: string | null
          org_postal_code: string | null
          org_street: string | null
          org_website: string | null
          primary_color: string | null
          secondary_color: string | null
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          logo_url?: string | null
          org_city?: string | null
          org_country?: string | null
          org_email?: string | null
          org_name?: string
          org_phone?: string | null
          org_postal_code?: string | null
          org_street?: string | null
          org_website?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          logo_url?: string | null
          org_city?: string | null
          org_country?: string | null
          org_email?: string | null
          org_name?: string
          org_phone?: string | null
          org_postal_code?: string | null
          org_street?: string | null
          org_website?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      patient_impairments: {
        Row: {
          created_at: string
          id: string
          impairment_type: Database["public"]["Enums"]["impairment_type"]
          patient_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impairment_type: Database["public"]["Enums"]["impairment_type"]
          patient_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impairment_type?: Database["public"]["Enums"]["impairment_type"]
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_impairments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          city: string | null
          comment: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          formatted_address: string | null
          geocode_status: string
          geocode_updated_at: string | null
          house_number: string | null
          id: string
          is_active: boolean
          last_name: string
          lat: number | null
          lng: number | null
          notes: string | null
          phone: string | null
          place_id: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          comment?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          formatted_address?: string | null
          geocode_status?: string
          geocode_updated_at?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          comment?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          formatted_address?: string | null
          geocode_status?: string
          geocode_updated_at?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          driver_id: string | null
          email: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          driver_id?: string | null
          email: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          driver_id?: string | null
          email?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_series: {
        Row: {
          appointment_end_time: string | null
          appointment_time: string | null
          created_at: string
          days_of_week: Database["public"]["Enums"]["day_of_week"][] | null
          destination_id: string
          direction: Database["public"]["Enums"]["ride_direction"]
          end_date: string | null
          id: string
          is_active: boolean
          notes: string | null
          patient_id: string
          pickup_time: string
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          return_pickup_time: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          appointment_end_time?: string | null
          appointment_time?: string | null
          created_at?: string
          days_of_week?: Database["public"]["Enums"]["day_of_week"][] | null
          destination_id: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id: string
          pickup_time: string
          recurrence_type: Database["public"]["Enums"]["recurrence_type"]
          return_pickup_time?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          appointment_end_time?: string | null
          appointment_time?: string | null
          created_at?: string
          days_of_week?: Database["public"]["Enums"]["day_of_week"][] | null
          destination_id?: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id?: string
          pickup_time?: string
          recurrence_type?: Database["public"]["Enums"]["recurrence_type"]
          return_pickup_time?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_series_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_series_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          appointment_end_time: string | null
          appointment_time: string | null
          calculated_price: number | null
          created_at: string
          date: string
          destination_id: string
          direction: Database["public"]["Enums"]["ride_direction"]
          distance_meters: number | null
          driver_id: string | null
          duration_category: string
          duration_seconds: number | null
          fare_rule_id: string | null
          has_escort: boolean
          id: string
          is_active: boolean
          is_tagesheim_imwil: boolean
          notes: string | null
          parent_ride_id: string | null
          patient_id: string
          pickup_time: string
          price_override: number | null
          price_override_reason: string | null
          return_pickup_time: string | null
          ride_series_id: string | null
          status: Database["public"]["Enums"]["ride_status"]
          surcharge_amount: number
          surcharge_details: Json | null
          polyline: string | null
          tariff_zone: string | null
          updated_at: string
          waiting_minutes: number
        }
        Insert: {
          appointment_end_time?: string | null
          appointment_time?: string | null
          calculated_price?: number | null
          created_at?: string
          date: string
          destination_id: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          distance_meters?: number | null
          driver_id?: string | null
          duration_category?: string
          duration_seconds?: number | null
          fare_rule_id?: string | null
          has_escort?: boolean
          id?: string
          is_active?: boolean
          is_tagesheim_imwil?: boolean
          notes?: string | null
          parent_ride_id?: string | null
          patient_id: string
          pickup_time: string
          price_override?: number | null
          price_override_reason?: string | null
          return_pickup_time?: string | null
          ride_series_id?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surcharge_amount?: number
          surcharge_details?: Json | null
          polyline?: string | null
          tariff_zone?: string | null
          updated_at?: string
          waiting_minutes?: number
        }
        Update: {
          appointment_end_time?: string | null
          appointment_time?: string | null
          calculated_price?: number | null
          created_at?: string
          date?: string
          destination_id?: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          distance_meters?: number | null
          driver_id?: string | null
          duration_category?: string
          duration_seconds?: number | null
          fare_rule_id?: string | null
          has_escort?: boolean
          id?: string
          is_active?: boolean
          is_tagesheim_imwil?: boolean
          notes?: string | null
          parent_ride_id?: string | null
          patient_id?: string
          pickup_time?: string
          price_override?: number | null
          price_override_reason?: string | null
          return_pickup_time?: string | null
          ride_series_id?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surcharge_amount?: number
          surcharge_details?: Json | null
          polyline?: string | null
          tariff_zone?: string | null
          updated_at?: string
          waiting_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "rides_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_fare_rule_id_fkey"
            columns: ["fare_rule_id"]
            isOneToOne: false
            referencedRelation: "fare_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_parent_ride_id_fkey"
            columns: ["parent_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_ride_series_id_fkey"
            columns: ["ride_series_id"]
            isOneToOne: false
            referencedRelation: "ride_series"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_postal_codes: {
        Row: {
          id: string
          postal_code: string
          zone_id: string
        }
        Insert: {
          id?: string
          postal_code: string
          zone_id: string
        }
        Update: {
          id?: string
          postal_code?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_postal_codes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_driver: {
        Args: { p_driver_id: string }
        Returns: undefined
      }
      anonymize_patient: {
        Args: { p_patient_id: string }
        Returns: undefined
      }
      archive_old_rides: {
        Args: { months_old?: number }
        Returns: {
          archived_rides_count: number
          deleted_logs_count: number
        }[]
      }
      get_user_driver_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      acceptance_stage:
        | "notified"
        | "reminder_1"
        | "reminder_2"
        | "timed_out"
        | "confirmed"
        | "rejected"
        | "cancelled"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      facility_type:
        | "practice"
        | "hospital"
        | "therapy_center"
        | "day_care"
        | "other"
      impairment_type: "rollator" | "wheelchair" | "stretcher" | "companion"
      recurrence_type: "daily" | "weekly" | "biweekly" | "monthly"
      rejection_reason:
        | "schedule_conflict"
        | "too_far"
        | "vehicle_issue"
        | "personal"
        | "other"
      resolution_method:
        | "driver_email"
        | "driver_app"
        | "dispatcher_override"
        | "timeout"
      ride_direction: "outbound" | "return" | "both"
      ride_status:
        | "unplanned"
        | "planned"
        | "confirmed"
        | "in_progress"
        | "picked_up"
        | "arrived"
        | "completed"
        | "cancelled"
        | "no_show"
        | "rejected"
      user_role: "admin" | "operator" | "driver"
      vehicle_type: "standard" | "wheelchair" | "stretcher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acceptance_stage: [
        "notified",
        "reminder_1",
        "reminder_2",
        "timed_out",
        "confirmed",
        "rejected",
        "cancelled",
      ],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      facility_type: [
        "practice",
        "hospital",
        "therapy_center",
        "day_care",
        "other",
      ],
      impairment_type: ["rollator", "wheelchair", "stretcher", "companion"],
      recurrence_type: ["daily", "weekly", "biweekly", "monthly"],
      rejection_reason: [
        "schedule_conflict",
        "too_far",
        "vehicle_issue",
        "personal",
        "other",
      ],
      resolution_method: [
        "driver_email",
        "driver_app",
        "dispatcher_override",
        "timeout",
      ],
      ride_direction: ["outbound", "return", "both"],
      ride_status: [
        "unplanned",
        "planned",
        "confirmed",
        "in_progress",
        "picked_up",
        "arrived",
        "completed",
        "cancelled",
        "no_show",
        "rejected",
      ],
      user_role: ["admin", "operator", "driver"],
      vehicle_type: ["standard", "wheelchair", "stretcher"],
    },
  },
} as const
