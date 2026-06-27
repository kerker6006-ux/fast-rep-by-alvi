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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          payload: Json | null
          target_user: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user?: string | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          call_type: string
          created_at: string
          estimated_cost: number
          id: string
          model: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          call_type?: string
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      auto_reply_rules: {
        Row: {
          created_at: string
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          response_text?: string
          response_text_bn?: string | null
          trigger_keywords?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_rules_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reply_rules_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          created_at: string
          fb_page_id: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fb_page_id?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fb_page_id?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_settings_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          created_at: string
          failed_count: number | null
          fb_page_id: string
          id: string
          message: string
          message_tag: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          total_recipients: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_count?: number | null
          fb_page_id: string
          id?: string
          message: string
          message_tag?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_count?: number | null
          fb_page_id?: string
          id?: string
          message?: string
          message_tag?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_trigger_logs: {
        Row: {
          comment_text: string | null
          commenter_id: string | null
          commenter_name: string | null
          created_at: string
          dm_sent_at: string | null
          dm_status: string
          error: string | null
          fb_comment_id: string
          fb_page_id_uuid: string | null
          fb_post_id: string | null
          id: string
          matched_keyword: string | null
          trigger_id: string | null
          user_id: string
        }
        Insert: {
          comment_text?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          created_at?: string
          dm_sent_at?: string | null
          dm_status?: string
          error?: string | null
          fb_comment_id: string
          fb_page_id_uuid?: string | null
          fb_post_id?: string | null
          id?: string
          matched_keyword?: string | null
          trigger_id?: string | null
          user_id: string
        }
        Update: {
          comment_text?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          created_at?: string
          dm_sent_at?: string | null
          dm_status?: string
          error?: string | null
          fb_comment_id?: string
          fb_page_id_uuid?: string | null
          fb_post_id?: string | null
          id?: string
          matched_keyword?: string | null
          trigger_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_trigger_logs_fb_page_id_uuid_fkey"
            columns: ["fb_page_id_uuid"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_trigger_logs_fb_page_id_uuid_fkey"
            columns: ["fb_page_id_uuid"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_trigger_logs_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "comment_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_triggers: {
        Row: {
          created_at: string
          daily_limit: number
          dm_image_url: string | null
          dm_message: string
          fb_page_id: string | null
          id: string
          is_enabled: boolean
          keywords: string[]
          last_sent_at: string | null
          match_type: string
          name: string
          priority: number
          public_reply: string | null
          sent_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          dm_image_url?: string | null
          dm_message: string
          fb_page_id?: string | null
          id?: string
          is_enabled?: boolean
          keywords?: string[]
          last_sent_at?: string | null
          match_type?: string
          name: string
          priority?: number
          public_reply?: string | null
          sent_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit?: number
          dm_image_url?: string | null
          dm_message?: string
          fb_page_id?: string | null
          id?: string
          is_enabled?: boolean
          keywords?: string[]
          last_sent_at?: string | null
          match_type?: string
          name?: string
          priority?: number
          public_reply?: string | null
          sent_count?: number
          updated_at?: string
          user_id?: string
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
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
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
          {
            foreignKeyName: "complaints_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          alert_seen_at: string | null
          channel: string
          created_at: string
          fb_page_id: string | null
          fb_sender_id: string
          followup_reason: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          needs_human: boolean
          opted_out: boolean | null
          sender_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alert_seen_at?: string | null
          channel?: string
          created_at?: string
          fb_page_id?: string | null
          fb_sender_id: string
          followup_reason?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          needs_human?: boolean
          opted_out?: boolean | null
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alert_seen_at?: string | null
          channel?: string
          created_at?: string
          fb_page_id?: string | null
          fb_sender_id?: string
          followup_reason?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          needs_human?: boolean
          opted_out?: boolean | null
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          amount_paid: number | null
          conversation_id: string | null
          course_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          fb_page_id: string | null
          fb_user_id: string | null
          granted_at: string | null
          id: string
          notes: string | null
          payment_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          conversation_id?: string | null
          course_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          fb_page_id?: string | null
          fb_user_id?: string | null
          granted_at?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          conversation_id?: string | null
          course_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          fb_page_id?: string | null
          fb_user_id?: string | null
          granted_at?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          order_index: number
          pdf_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          order_index?: number
          pdf_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          order_index?: number
          pdf_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          fb_page_id: string
          id: string
          is_active: boolean
          payment_instructions: string | null
          price: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          fb_page_id: string
          id?: string
          is_active?: boolean
          payment_instructions?: string | null
          price?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          fb_page_id?: string
          id?: string
          is_active?: boolean
          payment_instructions?: string | null
          price?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          stripe_session_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          confirmation_code: string
          created_at: string
          error: string | null
          id: string
          signed_request: string | null
          status: string
          updated_at: string
          user_facebook_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          confirmation_code: string
          created_at?: string
          error?: string | null
          id?: string
          signed_request?: string | null
          status?: string
          updated_at?: string
          user_facebook_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          confirmation_code?: string
          created_at?: string
          error?: string | null
          id?: string
          signed_request?: string | null
          status?: string
          updated_at?: string
          user_facebook_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
          ig_business_account_id: string | null
          ig_picture_url: string | null
          ig_subscription_status: string | null
          ig_username: string | null
          is_active: boolean
          last_sync_at: string | null
          page_access_token: string
          page_category: Database["public"]["Enums"]["page_category"] | null
          page_name: string | null
          page_picture_url: string | null
          pending_delete_at: string | null
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
          ig_business_account_id?: string | null
          ig_picture_url?: string | null
          ig_subscription_status?: string | null
          ig_username?: string | null
          is_active?: boolean
          last_sync_at?: string | null
          page_access_token: string
          page_category?: Database["public"]["Enums"]["page_category"] | null
          page_name?: string | null
          page_picture_url?: string | null
          pending_delete_at?: string | null
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
          ig_business_account_id?: string | null
          ig_picture_url?: string | null
          ig_subscription_status?: string | null
          ig_username?: string | null
          is_active?: boolean
          last_sync_at?: string | null
          page_access_token?: string
          page_category?: Database["public"]["Enums"]["page_category"] | null
          page_name?: string | null
          page_picture_url?: string | null
          pending_delete_at?: string | null
          subscribed_fields?: string[] | null
          subscription_error?: string | null
          subscription_status?: string | null
          user_id?: string
          verify_token?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          run_at: string
          started_at: string | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          started_at?: string | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          started_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["business_category"]
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          fb_page_id: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          preferred_date: string | null
          preferred_time: string | null
          service_or_product: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["business_category"]
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          fb_page_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_or_product?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["business_category"]
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          fb_page_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_or_product?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          fb_message_id: string | null
          fb_page_id: string | null
          id: string
          image_url: string | null
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          fb_message_id?: string | null
          fb_page_id?: string | null
          id?: string
          image_url?: string | null
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          fb_message_id?: string | null
          fb_page_id?: string | null
          id?: string
          image_url?: string | null
          read_at?: string | null
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
          {
            foreignKeyName: "messages_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          fb_page_id: string | null
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          fb_page_id?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          fb_page_id?: string | null
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
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
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
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
          {
            foreignKeyName: "orders_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      page_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          page_id: string
          role: Database["public"]["Enums"]["page_member_role"]
          status: Database["public"]["Enums"]["page_invite_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          page_id: string
          role: Database["public"]["Enums"]["page_member_role"]
          status?: Database["public"]["Enums"]["page_invite_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          page_id?: string
          role?: Database["public"]["Enums"]["page_member_role"]
          status?: Database["public"]["Enums"]["page_invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_invites_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_invites_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      page_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          page_id: string
          role: Database["public"]["Enums"]["page_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          page_id: string
          role: Database["public"]["Enums"]["page_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          page_id?: string
          role?: Database["public"]["Enums"]["page_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_members_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_members_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
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
          ai_duration_text: string | null
          ai_keywords: string[] | null
          ai_material: string | null
          ai_name: string | null
          ai_name_bn: string | null
          ai_price: number | null
          ai_price_text: string | null
          created_at: string
          fb_page_id: string | null
          fb_post_id: string | null
          id: string
          image_url: string | null
          kind: string
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
          ai_duration_text?: string | null
          ai_keywords?: string[] | null
          ai_material?: string | null
          ai_name?: string | null
          ai_name_bn?: string | null
          ai_price?: number | null
          ai_price_text?: string | null
          created_at?: string
          fb_page_id?: string | null
          fb_post_id?: string | null
          id?: string
          image_url?: string | null
          kind?: string
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
          ai_duration_text?: string | null
          ai_keywords?: string[] | null
          ai_material?: string | null
          ai_name?: string | null
          ai_name_bn?: string | null
          ai_price?: number | null
          ai_price_text?: string | null
          created_at?: string
          fb_page_id?: string | null
          fb_post_id?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          post_caption?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_products_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_products_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suggestions: {
        Row: {
          conversation_id: string | null
          created_at: string
          customer_name: string | null
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
          id?: string
          message_snippet?: string | null
          request_count?: number
          requested_product?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suggestions_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suggestions_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          description_bn: string | null
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "products_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_box_intro_dismissed: boolean
          avatar_url: string | null
          business_category:
            | Database["public"]["Enums"]["business_category"]
            | null
          business_info: Json
          country: string | null
          created_at: string
          display_name: string | null
          fb_24h_notice_dismissed: boolean
          free_until: string
          full_name: string | null
          id: string
          is_approved: boolean
          onboarded_at: string | null
          stripe_customer_id: string | null
          subscription_current_period_end: string | null
          subscription_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          suspended: boolean
          updated_at: string
          user_type: string | null
        }
        Insert: {
          alert_box_intro_dismissed?: boolean
          avatar_url?: string | null
          business_category?:
            | Database["public"]["Enums"]["business_category"]
            | null
          business_info?: Json
          country?: string | null
          created_at?: string
          display_name?: string | null
          fb_24h_notice_dismissed?: boolean
          free_until?: string
          full_name?: string | null
          id: string
          is_approved?: boolean
          onboarded_at?: string | null
          stripe_customer_id?: string | null
          subscription_current_period_end?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          suspended?: boolean
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          alert_box_intro_dismissed?: boolean
          avatar_url?: string | null
          business_category?:
            | Database["public"]["Enums"]["business_category"]
            | null
          business_info?: Json
          country?: string | null
          created_at?: string
          display_name?: string | null
          fb_24h_notice_dismissed?: boolean
          free_until?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          onboarded_at?: string | null
          stripe_customer_id?: string | null
          subscription_current_period_end?: string | null
          subscription_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          suspended?: boolean
          updated_at?: string
          user_type?: string | null
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          error: string | null
          fb_page_id: string | null
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
          error?: string | null
          fb_page_id?: string | null
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
          error?: string | null
          fb_page_id?: string | null
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
          {
            foreignKeyName: "scheduled_messages_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          duration_text: string | null
          faqs: Json
          fb_page_id: string | null
          id: string
          image_url: string | null
          keywords: string[]
          name: string
          price_text: string | null
          service_area: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_text?: string | null
          faqs?: Json
          fb_page_id?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[]
          name: string
          price_text?: string | null
          service_area?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_text?: string | null
          faqs?: Json
          fb_page_id?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[]
          name?: string
          price_text?: string | null
          service_area?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      training_suggestions: {
        Row: {
          created_at: string
          fb_page_id: string | null
          id: string
          kind: string
          payload: Json
          reason: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fb_page_id?: string | null
          id?: string
          kind: string
          payload?: Json
          reason?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fb_page_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          reason?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_suggestions_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_suggestions_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
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
      webhook_failures: {
        Row: {
          created_at: string
          error: string
          id: string
          payload: Json | null
          resolved_at: string | null
          retry_count: number
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error: string
          id?: string
          payload?: Json | null
          resolved_at?: string | null
          retry_count?: number
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string
          id?: string
          payload?: Json | null
          resolved_at?: string | null
          retry_count?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      website_knowledge: {
        Row: {
          content: string | null
          created_at: string
          fb_page_id: string | null
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
          fb_page_id?: string | null
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
          fb_page_id?: string | null
          id?: string
          page_url?: string
          source_url?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_knowledge_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_knowledge_fb_page_id_fkey"
            columns: ["fb_page_id"]
            isOneToOne: false
            referencedRelation: "fb_pages_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_analysis: {
        Row: {
          analysis: Json
          conversations_scanned: number
          created_at: string
          fb_page_id: string
          id: string
          messages_scanned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          conversations_scanned?: number
          created_at?: string
          fb_page_id: string
          id?: string
          messages_scanned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          conversations_scanned?: number
          created_at?: string
          fb_page_id?: string
          id?: string
          messages_scanned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fb_pages_safe: {
        Row: {
          connected_at: string | null
          created_at: string | null
          disconnected_at: string | null
          fb_page_id: string | null
          id: string | null
          ig_business_account_id: string | null
          ig_picture_url: string | null
          ig_subscription_status: string | null
          ig_username: string | null
          is_active: boolean | null
          last_sync_at: string | null
          page_category: Database["public"]["Enums"]["page_category"] | null
          page_name: string | null
          page_picture_url: string | null
          pending_delete_at: string | null
          subscribed_fields: string[] | null
          subscription_error: string | null
          subscription_status: string | null
          user_id: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          disconnected_at?: string | null
          fb_page_id?: string | null
          id?: string | null
          ig_business_account_id?: string | null
          ig_picture_url?: string | null
          ig_subscription_status?: string | null
          ig_username?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          page_category?: Database["public"]["Enums"]["page_category"] | null
          page_name?: string | null
          page_picture_url?: string | null
          pending_delete_at?: string | null
          subscribed_fields?: string[] | null
          subscription_error?: string | null
          subscription_status?: string | null
          user_id?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          disconnected_at?: string | null
          fb_page_id?: string | null
          id?: string | null
          ig_business_account_id?: string | null
          ig_picture_url?: string | null
          ig_subscription_status?: string | null
          ig_username?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          page_category?: Database["public"]["Enums"]["page_category"] | null
          page_name?: string | null
          page_picture_url?: string | null
          pending_delete_at?: string | null
          subscribed_fields?: string[] | null
          subscription_error?: string | null
          subscription_status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_data_deletion_status: {
        Args: { _code: string }
        Returns: {
          completed_at: string
          created_at: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_can_manage_fb_page: {
        Args: { _fb_page_id: string }
        Returns: boolean
      }
      user_can_manage_page: { Args: { _page_id: string }; Returns: boolean }
      user_has_fb_page_access: {
        Args: { _fb_page_id: string }
        Returns: boolean
      }
      user_has_page_access: { Args: { _page_id: string }; Returns: boolean }
      user_owns_page: { Args: { _page_id: string }; Returns: boolean }
      user_page_role: { Args: { _page_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
      business_category:
        | "ecommerce"
        | "dental"
        | "hvac"
        | "salon"
        | "service"
        | "content_creator"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "delivered"
        | "cancelled"
      page_category: "ecommerce" | "service" | "content_creator"
      page_invite_status: "pending" | "accepted" | "revoked" | "expired"
      page_member_role: "full" | "moderator"
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
      business_category: [
        "ecommerce",
        "dental",
        "hvac",
        "salon",
        "service",
        "content_creator",
      ],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "delivered",
        "cancelled",
      ],
      page_category: ["ecommerce", "service", "content_creator"],
      page_invite_status: ["pending", "accepted", "revoked", "expired"],
      page_member_role: ["full", "moderator"],
      scheduled_message_status: ["pending", "sent", "failed", "cancelled"],
    },
  },
} as const
