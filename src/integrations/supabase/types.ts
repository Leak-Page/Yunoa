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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      billing_settings: {
        Row: {
          card_auto_renew: boolean
          created_at: string
          notify_before_days: number
          paypal_auto_renew: boolean
          paysafecard_auto_renew: boolean
          preferred_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_auto_renew?: boolean
          created_at?: string
          notify_before_days?: number
          paypal_auto_renew?: boolean
          paysafecard_auto_renew?: boolean
          preferred_method?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_auto_renew?: boolean
          created_at?: string
          notify_before_days?: number
          paypal_auto_renew?: boolean
          paysafecard_auto_renew?: boolean
          preferred_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          updated_at: string | null
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          updated_at?: string | null
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          updated_at?: string | null
          used?: boolean | null
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          episode_number: number
          id: string
          season_number: number | null
          series_id: string
          thumbnail: string | null
          title: string
          updated_at: string
          video_url: string
          views: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          episode_number: number
          id?: string
          season_number?: number | null
          series_id: string
          thumbnail?: string | null
          title: string
          updated_at?: string
          video_url: string
          views?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          episode_number?: number
          id?: string
          season_number?: number | null
          series_id?: string
          thumbnail?: string | null
          title?: string
          updated_at?: string
          video_url?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          added_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          added_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          is_recurring: boolean
          plan_id: string | null
          provider: string
          provider_session_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          is_recurring?: boolean
          plan_id?: string | null
          provider: string
          provider_session_id?: string | null
          status: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          is_recurring?: boolean
          plan_id?: string | null
          provider?: string
          provider_session_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          has_ads: boolean
          id: string
          interval: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          has_ads?: boolean
          id?: string
          interval: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          has_ads?: boolean
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_suspensions: {
        Row: {
          created_at: string
          days_remaining: number | null
          id: string
          is_active: boolean
          original_end_date: string | null
          reason: string
          subscription_id: string | null
          suspended_at: string
          suspended_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_remaining?: number | null
          id?: string
          is_active?: boolean
          original_end_date?: string | null
          reason: string
          subscription_id?: string | null
          suspended_at?: string
          suspended_by: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_remaining?: number | null
          id?: string
          is_active?: boolean
          original_end_date?: string | null
          reason?: string
          subscription_id?: string | null
          suspended_at?: string
          suspended_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_suspensions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_suspensions_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_suspensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          payment_method: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payment_method: string
          plan_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payment_method?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtitles: {
        Row: {
          created_at: string | null
          episode_id: string | null
          id: string
          is_default: boolean | null
          language: string
          language_name: string
          subtitle_url: string
          updated_at: string | null
          video_id: string
        }
        Insert: {
          created_at?: string | null
          episode_id?: string | null
          id?: string
          is_default?: boolean | null
          language: string
          language_name: string
          subtitle_url: string
          updated_at?: string | null
          video_id: string
        }
        Update: {
          created_at?: string | null
          episode_id?: string | null
          id?: string
          is_default?: boolean | null
          language?: string
          language_name?: string
          subtitle_url?: string
          updated_at?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtitles_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtitles_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          banned_at: string
          banned_by: string
          created_at: string
          id: string
          is_active: boolean
          is_permanent: boolean
          reason: string
          unban_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason: string
          unban_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason?: string
          unban_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_video_views: {
        Row: {
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
          video_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
          video_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
          video_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_video_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          average_rating: number | null
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          duration: string | null
          id: string
          language: string | null
          thumbnail: string | null
          title: string
          total_episodes: number | null
          total_ratings: number | null
          total_seasons: number | null
          type: string | null
          updated_at: string
          video_url: string
          views: number | null
          year: number | null
        }
        Insert: {
          average_rating?: number | null
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          duration?: string | null
          id?: string
          language?: string | null
          thumbnail?: string | null
          title: string
          total_episodes?: number | null
          total_ratings?: number | null
          total_seasons?: number | null
          type?: string | null
          updated_at?: string
          video_url: string
          views?: number | null
          year?: number | null
        }
        Update: {
          average_rating?: number | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          duration?: string | null
          id?: string
          language?: string | null
          thumbnail?: string | null
          title?: string
          total_episodes?: number | null
          total_ratings?: number | null
          total_seasons?: number | null
          type?: string | null
          updated_at?: string
          video_url?: string
          views?: number | null
          year?: number | null
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          current_position: number
          episode_id: string | null
          id: string
          progress: number
          total_duration: number | null
          updated_at: string
          user_id: string
          video_id: string | null
          watched_at: string
        }
        Insert: {
          current_position?: number
          episode_id?: string | null
          id?: string
          progress?: number
          total_duration?: number | null
          updated_at?: string
          user_id: string
          video_id?: string | null
          watched_at?: string
        }
        Update: {
          current_position?: number
          episode_id?: string | null
          id?: string
          progress?: number
          total_duration?: number | null
          updated_at?: string
          user_id?: string
          video_id?: string | null
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          webhook_type: string
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_type: string
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          webhook_type?: string
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_verification_codes: { Args: never; Returns: number }
      get_current_user_role: { Args: never; Returns: string }
      get_user_with_email: {
        Args: { user_uuid: string }
        Returns: {
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          username: string
        }[]
      }
      get_users_with_emails: {
        Args: never
        Returns: {
          avatar: string
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          username: string
        }[]
      }
      get_users_with_emails_simple: {
        Args: never
        Returns: {
          avatar: string
          created_at: string
          email: string
          id: string
          role: string
          updated_at: string
          username: string
        }[]
      }
      is_user_banned: {
        Args: { user_uuid: string }
        Returns: {
          ban_reason: string
          banned_at: string
          banned_by_username: string
          is_banned: boolean
          is_permanent: boolean
          unban_at: string
        }[]
      }
      verify_email_code: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
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
