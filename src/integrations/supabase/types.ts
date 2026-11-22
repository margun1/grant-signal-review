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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcement_materials: {
        Row: {
          announcement_id: string
          content: string | null
          created_at: string
          created_by: string | null
          failure_reason: string | null
          fetch_status: string
          id: string
          kind: string
          name: string
          page_count: number | null
          source_url: string | null
          storage_path: string | null
        }
        Insert: {
          announcement_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          fetch_status?: string
          id?: string
          kind: string
          name: string
          page_count?: number | null
          source_url?: string | null
          storage_path?: string | null
        }
        Update: {
          announcement_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          fetch_status?: string
          id?: string
          kind?: string
          name?: string
          page_count?: number | null
          source_url?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_materials_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          analysis: Json | null
          analysis_error: string | null
          analysis_status: string
          created_at: string
          created_by: string
          deadline: string | null
          fit_level: string | null
          id: string
          organizer: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          status_note: string | null
          status_updated_at: string
          status_updated_by: string | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          analysis?: Json | null
          analysis_error?: string | null
          analysis_status?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          fit_level?: string | null
          id?: string
          organizer?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          status_note?: string | null
          status_updated_at?: string
          status_updated_by?: string | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          analysis?: Json | null
          analysis_error?: string | null
          analysis_status?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          fit_level?: string | null
          id?: string
          organizer?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          status_note?: string | null
          status_updated_at?: string
          status_updated_by?: string | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          revoked: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          revoked?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          revoked?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      plan_reviews: {
        Row: {
          announcement_id: string
          created_at: string
          draft_name: string
          draft_path: string
          error: string | null
          executed_by: string
          id: string
          material_names: string[]
          request_key: string
          result: Json | null
          round: number
          status: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          draft_name: string
          draft_path: string
          error?: string | null
          executed_by?: string
          id?: string
          material_names?: string[]
          request_key: string
          result?: Json | null
          round: number
          status?: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          draft_name?: string
          draft_path?: string
          error?: string | null
          executed_by?: string
          id?: string
          material_names?: string[]
          request_key?: string
          result?: Json | null
          round?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reviews_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      set_user_role: {
        Args: {
          _enabled: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      announcement_status: "검토 중" | "진행" | "보류" | "미진행"
      app_role: "admin" | "manager" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      announcement_status: ["검토 중", "진행", "보류", "미진행"],
      app_role: ["admin", "manager", "staff"],
    },
  },
} as const
