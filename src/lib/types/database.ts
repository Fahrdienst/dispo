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
          created_at: string
          department: string | null
          house_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          postal_code: string | null
          street: string | null
          type: Database["public"]["Enums"]["destination_type"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          department?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          postal_code?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["destination_type"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          department?: string | null
          house_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          postal_code?: string | null
          street?: string | null
          type?: Database["public"]["Enums"]["destination_type"]
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
          is_active: boolean
          specific_date: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
          driver_id: string
          end_time: string
          id?: string
          is_active?: boolean
          specific_date?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"] | null
          driver_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          specific_date?: string | null
          start_time?: string
          updated_at?: string
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
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      patient_impairments: {
        Row: {
          id: string
          patient_id: string
          impairment_type: Database["public"]["Enums"]["impairment_type"]
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          impairment_type: Database["public"]["Enums"]["impairment_type"]
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          impairment_type?: Database["public"]["Enums"]["impairment_type"]
          created_at?: string
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
          house_number: string | null
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
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
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
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
          house_number?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
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
          start_date: string
          updated_at: string
        }
        Insert: {
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
          start_date: string
          updated_at?: string
        }
        Update: {
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
          created_at: string
          date: string
          destination_id: string
          direction: Database["public"]["Enums"]["ride_direction"]
          driver_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          patient_id: string
          pickup_time: string
          ride_series_id: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          destination_id: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          driver_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id: string
          pickup_time: string
          ride_series_id?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          destination_id?: string
          direction?: Database["public"]["Enums"]["ride_direction"]
          driver_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          patient_id?: string
          pickup_time?: string
          ride_series_id?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_driver_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      destination_type: "hospital" | "doctor" | "therapy" | "other"
      impairment_type: "rollator" | "wheelchair" | "stretcher" | "companion"
      recurrence_type: "daily" | "weekly" | "biweekly" | "monthly"
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
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      destination_type: ["hospital", "doctor", "therapy", "other"],
      impairment_type: ["rollator", "wheelchair", "stretcher", "companion"],
      recurrence_type: ["daily", "weekly", "biweekly", "monthly"],
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
