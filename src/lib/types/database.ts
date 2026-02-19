/**
 * Database type definitions for Supabase.
 *
 * Hand-written to match the schema defined in ADR-002 and the initial migration.
 * These types will eventually be replaced by auto-generated types via:
 *   npx supabase gen types typescript --local > src/lib/types/database.ts
 *
 * Until then, these provide full type safety for all database operations.
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: Database['public']['Enums']['user_role']
          display_name: string
          driver_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: Database['public']['Enums']['user_role']
          display_name: string
          driver_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: Database['public']['Enums']['user_role']
          display_name?: string
          driver_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: true
            referencedRelation: 'drivers'
            referencedColumns: ['id']
          },
        ]
      }
      patients: {
        Row: {
          id: string
          first_name: string
          last_name: string
          phone: string | null
          street: string | null
          house_number: string | null
          postal_code: string | null
          city: string | null
          needs_wheelchair: boolean
          needs_stretcher: boolean
          needs_companion: boolean
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          phone?: string | null
          street?: string | null
          house_number?: string | null
          postal_code?: string | null
          city?: string | null
          needs_wheelchair?: boolean
          needs_stretcher?: boolean
          needs_companion?: boolean
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          street?: string | null
          house_number?: string | null
          postal_code?: string | null
          city?: string | null
          needs_wheelchair?: boolean
          needs_stretcher?: boolean
          needs_companion?: boolean
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          id: string
          first_name: string
          last_name: string
          phone: string | null
          vehicle_type: Database['public']['Enums']['vehicle_type']
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          phone?: string | null
          vehicle_type?: Database['public']['Enums']['vehicle_type']
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          vehicle_type?: Database['public']['Enums']['vehicle_type']
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          id: string
          name: string
          type: Database['public']['Enums']['destination_type']
          street: string | null
          house_number: string | null
          postal_code: string | null
          city: string | null
          department: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: Database['public']['Enums']['destination_type']
          street?: string | null
          house_number?: string | null
          postal_code?: string | null
          city?: string | null
          department?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database['public']['Enums']['destination_type']
          street?: string | null
          house_number?: string | null
          postal_code?: string | null
          city?: string | null
          department?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ride_series: {
        Row: {
          id: string
          patient_id: string
          destination_id: string
          recurrence_type: Database['public']['Enums']['recurrence_type']
          days_of_week: Database['public']['Enums']['day_of_week'][] | null
          pickup_time: string
          direction: Database['public']['Enums']['ride_direction']
          start_date: string
          end_date: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          destination_id: string
          recurrence_type: Database['public']['Enums']['recurrence_type']
          days_of_week?: Database['public']['Enums']['day_of_week'][] | null
          pickup_time: string
          direction?: Database['public']['Enums']['ride_direction']
          start_date: string
          end_date?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          destination_id?: string
          recurrence_type?: Database['public']['Enums']['recurrence_type']
          days_of_week?: Database['public']['Enums']['day_of_week'][] | null
          pickup_time?: string
          direction?: Database['public']['Enums']['ride_direction']
          start_date?: string
          end_date?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ride_series_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ride_series_destination_id_fkey'
            columns: ['destination_id']
            isOneToOne: false
            referencedRelation: 'destinations'
            referencedColumns: ['id']
          },
        ]
      }
      rides: {
        Row: {
          id: string
          patient_id: string
          destination_id: string
          driver_id: string | null
          ride_series_id: string | null
          date: string
          pickup_time: string
          direction: Database['public']['Enums']['ride_direction']
          status: Database['public']['Enums']['ride_status']
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          destination_id: string
          driver_id?: string | null
          ride_series_id?: string | null
          date: string
          pickup_time: string
          direction?: Database['public']['Enums']['ride_direction']
          status?: Database['public']['Enums']['ride_status']
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          destination_id?: string
          driver_id?: string | null
          ride_series_id?: string | null
          date?: string
          pickup_time?: string
          direction?: Database['public']['Enums']['ride_direction']
          status?: Database['public']['Enums']['ride_status']
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rides_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rides_destination_id_fkey'
            columns: ['destination_id']
            isOneToOne: false
            referencedRelation: 'destinations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rides_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: false
            referencedRelation: 'drivers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rides_ride_series_id_fkey'
            columns: ['ride_series_id']
            isOneToOne: false
            referencedRelation: 'ride_series'
            referencedColumns: ['id']
          },
        ]
      }
      driver_availability: {
        Row: {
          id: string
          driver_id: string
          day_of_week: Database['public']['Enums']['day_of_week'] | null
          specific_date: string | null
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          day_of_week?: Database['public']['Enums']['day_of_week'] | null
          specific_date?: string | null
          start_time: string
          end_time: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          day_of_week?: Database['public']['Enums']['day_of_week'] | null
          specific_date?: string | null
          start_time?: string
          end_time?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'driver_availability_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: false
            referencedRelation: 'drivers'
            referencedColumns: ['id']
          },
        ]
      }
      communication_log: {
        Row: {
          id: string
          ride_id: string
          author_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ride_id: string
          author_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ride_id?: string
          author_id?: string
          message?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'communication_log_ride_id_fkey'
            columns: ['ride_id']
            isOneToOne: false
            referencedRelation: 'rides'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'communication_log_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_role: {
        Args: Record<string, never>
        Returns: Database['public']['Enums']['user_role']
      }
      get_user_driver_id: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: {
      user_role: 'admin' | 'operator' | 'driver'
      ride_status:
        | 'unplanned'
        | 'planned'
        | 'confirmed'
        | 'in_progress'
        | 'picked_up'
        | 'arrived'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | 'rejected'
      ride_direction: 'outbound' | 'return' | 'both'
      destination_type: 'hospital' | 'doctor' | 'therapy' | 'other'
      vehicle_type: 'standard' | 'wheelchair' | 'stretcher'
      recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly'
      day_of_week:
        | 'monday'
        | 'tuesday'
        | 'wednesday'
        | 'thursday'
        | 'friday'
        | 'saturday'
        | 'sunday'
    }
    CompositeTypes: Record<string, never>
  }
}

// =============================================================================
// Convenience type aliases
// =============================================================================

/** Extract the Row type for a given table name */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Extract the Insert type for a given table name */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Extract the Update type for a given table name */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/** Extract an enum type by name */
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
