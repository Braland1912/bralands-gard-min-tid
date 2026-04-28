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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      checklist_template_items: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          template_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          template_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          template_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_shift_types: {
        Row: {
          created_at: string
          id: string
          shift_type: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift_type: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shift_type?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_shift_types_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_count?: number
        }
        Relationships: []
      }
      pending_members: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          invitation_id: string | null
          last_name: string
          phone: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          invitation_id?: string | null
          last_name: string
          phone: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invitation_id?: string | null
          last_name?: string
          phone?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_members_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_days: {
        Row: {
          created_at: string
          date: string
          id: string
          is_published: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_published?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          shift_index: number
          shift_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          shift_index?: number
          shift_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          shift_index?: number
          shift_type?: string
          user_id?: string
        }
        Relationships: []
      }
      shift_checklist_items: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          shift_checklist_id: string
          sort_order: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          shift_checklist_id: string
          sort_order?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          shift_checklist_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklist_items_shift_checklist_id_fkey"
            columns: ["shift_checklist_id"]
            isOneToOne: false
            referencedRelation: "shift_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_checklists: {
        Row: {
          created_at: string
          id: string
          name: string
          shift_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          shift_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          shift_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_checklists_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      time_correction_requests: {
        Row: {
          admin_note: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          reason: string
          status: string
          worker_id: string
          worker_name: string
        }
        Insert: {
          admin_note?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          reason: string
          status?: string
          worker_id: string
          worker_name: string
        }
        Update: {
          admin_note?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          reason?: string
          status?: string
          worker_id?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_correction_requests_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          id: string
          worker_id: string
          worker_name: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string
          worker_id: string
          worker_name: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          id?: string
          worker_id?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
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
      workers: {
        Row: {
          can_see_team: boolean
          created_at: string | null
          hourly_rate: number | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          can_see_team?: boolean
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          can_see_team?: boolean
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          user_id?: string | null
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
