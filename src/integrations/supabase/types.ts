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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          call_type: string
          created_at: string
          estimated_cost: number
          id: string
          model: string
          user_id: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          user_id: string
        }
        Update: {
          call_type?: string
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_reply_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          priority: number
          response_text: string
          response_text_bn: string | null
          trigger_keywords: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          response_text: string
          response_text_bn?: string | null
          trigger_keywords?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number
          response_text?: string
          response_text_bn?: string | null
          trigger_keywords?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          complaint_text: string
          conversation_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          complaint_text: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          complaint_text?: string
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          fb_sender_id: string
          followup_reason: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          needs_human: boolean
          sender_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fb_sender_id: string
          followup_reason?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          needs_human?: boolean
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fb_sender_id?: string
          followup_reason?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          needs_human?: boolean
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      fb_oauth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          pages: Json
          session_token: string
          user_access_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          pages: Json
          session_token: string
          user_access_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          pages?: Json
          session_token?: string
          user_access_token?: string
          user_id?: string
        }
        Relationships: []
      }
      fb_pages: {
        Row: {
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          fb_page_id: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          page_access_token: string
          page_name: string | null
          page_picture_url: string | null
          subscribed_fields: string[] | null
          subscription_error: string | null
          subscription_status: string | null
          user_id: string
          verify_token: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          fb_page_id: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          page_access_token: string
          page_name?: string | null
          page_picture_url?: string | null
          subscribed_fields?: string[] | null
          subscription_error?: string | null
          subscription_status?: string | null
          user_id: string
          verify_token?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          fb_page_id?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          page_access_token?: string
          page_name?: string | null
          page_picture_url?: string | null
          subscribed_fields?: string[] | null
          subscription_error?: string | null
          subscription_status?: string | null
          user_id?: string
          verify_token?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          fb_message_id: string | null
          id: string
          image_url: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          fb_message_id?: string | null
          id?: string
          image_url?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          fb_message_id?: string | null
          id?: string
          image_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          conversation_id: string | null
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_products: {
        Row: {
          ai_category: string | null
          ai_color: string | null
          ai_description: string | null
          ai_description_bn: string | null
          ai_keywords: string[] | null
          ai_material: string | null
          ai_name: string | null
          ai_name_bn: string | null
          ai_price: number | null
          created_at: string
          fb_post_id: string | null
          id: string
          image_url: string | null
          post_caption: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category?: string | null
          ai_color?: string | null
          ai_description?: string | null
          ai_description_bn?: string | null
          ai_keywords?: string[] | null
          ai_material?: string | null
          ai_name?: string | null
          ai_name_bn?: string | null
          ai_price?: number | null
          created_at?: string
          fb_post_id?: string | null
          id?: string
          image_url?: string | null
          post_caption?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category?: string | null
          ai_color?: string | null
          ai_description?: string | null
          ai_description_bn?: string | null
          ai_keywords?: string[] | null
          ai_material?: string | null
          ai_name?: string | null
          ai_name_bn?: string | null
          ai_price?: number | null
          created_at?: string
          fb_post_id?: string | null
          id?: string
          image_url?: string | null
          post_caption?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_suggestions: {
        Row: {
          conversation_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          message_snippet: string | null
          request_count: number
          requested_product: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          message_snippet?: string | null
          request_count?: number
          requested_product: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          message_snippet?: string | null
          request_count?: number
          requested_product?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          description_bn: string | null
          id: string
          image_url: string | null
          is_active: boolean
          keywords: string[] | null
          material: string | null
          name: string
          name_bn: string | null
          price: number
          size: string | null
          size_variants: Json
          updated_at: string
          user_id: string | null
          variants: Json | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          description_bn?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string[] | null
          material?: string | null
          name: string
          name_bn?: string | null
          price?: number
          size?: string | null
          size_variants?: Json
          updated_at?: string
          user_id?: string | null
          variants?: Json | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          description_bn?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string[] | null
          material?: string | null
          name?: string
          name_bn?: string | null
          price?: number
          size?: string | null
          size_variants?: Json
          updated_at?: string
          user_id?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_approved: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_approved?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          message_type: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["scheduled_message_status"]
          user_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_type?: string
          scheduled_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["scheduled_message_status"]
          user_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_type?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["scheduled_message_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
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
      website_knowledge: {
        Row: {
          content: string | null
          created_at: string
          id: string
          page_url: string
          source_url: string
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          page_url: string
          source_url: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          page_url?: string
          source_url?: string
          summary?: string | null
          title?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "delivered"
        | "cancelled"
      scheduled_message_status: "pending" | "sent" | "failed" | "cancelled"
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
      app_role: ["admin", "user"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "delivered",
        "cancelled",
      ],
      scheduled_message_status: ["pending", "sent", "failed", "cancelled"],
    },
  },
} as const
