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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      itinerary_days: {
        Row: {
          created_at: string
          date: string | null
          day_number: number
          estimated_day_cost: number | null
          id: string
          notes: string | null
          theme: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          day_number: number
          estimated_day_cost?: number | null
          id?: string
          notes?: string | null
          theme?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string | null
          day_number?: number
          estimated_day_cost?: number | null
          id?: string
          notes?: string | null
          theme?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          accessibility_note: string | null
          created_at: string
          day_id: string
          description: string | null
          duration_minutes: number | null
          estimated_cost: number | null
          id: string
          sort_order: number
          time_of_day: string
          title: string
          transport_note: string | null
          travel_time_minutes: number | null
          user_id: string
          why_it_fits: string | null
        }
        Insert: {
          accessibility_note?: string | null
          created_at?: string
          day_id: string
          description?: string | null
          duration_minutes?: number | null
          estimated_cost?: number | null
          id?: string
          sort_order?: number
          time_of_day?: string
          title: string
          transport_note?: string | null
          travel_time_minutes?: number | null
          user_id: string
          why_it_fits?: string | null
        }
        Update: {
          accessibility_note?: string | null
          created_at?: string
          day_id?: string
          description?: string | null
          duration_minutes?: number | null
          estimated_cost?: number | null
          id?: string
          sort_order?: number
          time_of_day?: string
          title?: string
          transport_note?: string | null
          travel_time_minutes?: number | null
          user_id?: string
          why_it_fits?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_preferences: {
        Row: {
          accessibility_needs: string[]
          accessibility_notes: string | null
          accommodation: string[]
          budget_flexibility: string | null
          children_ages: string | null
          created_at: string
          destination_flexible: boolean
          free_text: string | null
          id: string
          pace: string | null
          preferred_region: string | null
          transportation: string[]
          travel_styles: string[]
          trip_id: string
          user_id: string
        }
        Insert: {
          accessibility_needs?: string[]
          accessibility_notes?: string | null
          accommodation?: string[]
          budget_flexibility?: string | null
          children_ages?: string | null
          created_at?: string
          destination_flexible?: boolean
          free_text?: string | null
          id?: string
          pace?: string | null
          preferred_region?: string | null
          transportation?: string[]
          travel_styles?: string[]
          trip_id: string
          user_id: string
        }
        Update: {
          accessibility_needs?: string[]
          accessibility_notes?: string | null
          accommodation?: string[]
          budget_flexibility?: string | null
          children_ages?: string | null
          created_at?: string
          destination_flexible?: boolean
          free_text?: string | null
          id?: string
          pace?: string | null
          preferred_region?: string | null
          transportation?: string[]
          travel_styles?: string[]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          agent_reasoning: Json
          budget_breakdown: Json
          budget_category: string | null
          budget_total: number | null
          created_at: string
          currency: string
          days_count: number
          destination: string
          end_date: string | null
          fit_score: number | null
          guide: Json
          id: string
          overview: string | null
          start_date: string | null
          title: string
          travelers_adults: number
          travelers_children: number
          trip_check: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_reasoning?: Json
          budget_breakdown?: Json
          budget_category?: string | null
          budget_total?: number | null
          created_at?: string
          currency?: string
          days_count?: number
          destination?: string
          end_date?: string | null
          fit_score?: number | null
          guide?: Json
          id?: string
          overview?: string | null
          start_date?: string | null
          title?: string
          travelers_adults?: number
          travelers_children?: number
          trip_check?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_reasoning?: Json
          budget_breakdown?: Json
          budget_category?: string | null
          budget_total?: number | null
          created_at?: string
          currency?: string
          days_count?: number
          destination?: string
          end_date?: string | null
          fit_score?: number | null
          guide?: Json
          id?: string
          overview?: string | null
          start_date?: string | null
          title?: string
          travelers_adults?: number
          travelers_children?: number
          trip_check?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
