export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      diary_entries: {
        Row: {
          created_at: string
          id: string
          is_revisit: boolean
          logged_at: string
          media_id: string
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_revisit?: boolean
          logged_at?: string
          media_id: string
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_revisit?: boolean
          logged_at?: string
          media_id?: string
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          media_id: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          created_at: string
          id: string
          list_id: string
          media_id: string
          note: string | null
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          media_id: string
          note?: string | null
          position: number
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          media_id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_ranked: boolean
          slug: string
          title: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["list_visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_ranked?: boolean
          slug: string
          title: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["list_visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_ranked?: boolean
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["list_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          average_rating: number | null
          backdrop_url: string | null
          content_hash: string | null
          created_at: string
          details: Json
          external_id: string
          genres: string[]
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          normalization_version: string | null
          poster_url: string | null
          search_tsv: unknown
          slug: string
          source: string
          subtitle: string | null
          synced_at: string | null
          synopsis: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          average_rating?: number | null
          backdrop_url?: string | null
          content_hash?: string | null
          created_at?: string
          details?: Json
          external_id: string
          genres?: string[]
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          normalization_version?: string | null
          poster_url?: string | null
          search_tsv?: unknown
          slug: string
          source?: string
          subtitle?: string | null
          synced_at?: string | null
          synopsis?: string
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          average_rating?: number | null
          backdrop_url?: string | null
          content_hash?: string | null
          created_at?: string
          details?: Json
          external_id?: string
          genres?: string[]
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          normalization_version?: string | null
          poster_url?: string | null
          search_tsv?: unknown
          slug?: string
          source?: string
          subtitle?: string | null
          synced_at?: string | null
          synopsis?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      media_search_documents: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          document_version: string
          embedded_at: string | null
          embedding: string | null
          embedding_dimensions: number | null
          embedding_model: string | null
          embedding_provider: string | null
          media_id: string
          updated_at: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          document_version?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          embedding_provider?: string | null
          media_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          document_version?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          embedding_provider?: string | null
          media_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_search_documents_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          location: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          location?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          location?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string
          contains_spoilers: boolean
          created_at: string
          diary_entry_id: string | null
          id: string
          media_id: string
          rating: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          contains_spoilers?: boolean
          created_at?: string
          diary_entry_id?: string | null
          id?: string
          media_id: string
          rating?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          contains_spoilers?: boolean
          created_at?: string
          diary_entry_id?: string | null
          id?: string
          media_id?: string
          rating?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_list_item: {
        Args: { p_list_id: string; p_media_slug: string }
        Returns: Json
      }
      compatible_embedding_count: {
        Args: {
          p_dimensions: number
          p_document_version: string
          p_model: string
          p_provider: string
        }
        Returns: number
      }
      create_list: {
        Args: {
          p_description?: string
          p_is_ranked?: boolean
          p_media_slug?: string
          p_title: string
          p_visibility?: string
        }
        Returns: Json
      }
      delete_diary_entry: { Args: { p_diary_entry_id: string }; Returns: Json }
      delete_list: { Args: { p_list_id: string }; Returns: Json }
      hybrid_search: {
        Args: {
          p_dimensions: number
          p_document_version: string
          p_kind?: Database["public"]["Enums"]["media_kind"]
          p_limit?: number
          p_max_distance?: number
          p_model: string
          p_provider: string
          p_query: string
          p_query_embedding: string
        }
        Returns: {
          average_rating: number
          backdrop_url: string
          details: Json
          genres: string[]
          kind: Database["public"]["Enums"]["media_kind"]
          media_id: string
          poster_url: string
          rank: number
          slug: string
          subtitle: string
          synopsis: string
          title: string
          year: number
        }[]
      }
      jsonb_text_array_to_string: { Args: { p: Json }; Returns: string }
      keyword_search: {
        Args: {
          p_kind?: Database["public"]["Enums"]["media_kind"]
          p_limit?: number
          p_query: string
        }
        Returns: {
          average_rating: number
          backdrop_url: string
          details: Json
          genres: string[]
          kind: Database["public"]["Enums"]["media_kind"]
          media_id: string
          poster_url: string
          rank: number
          slug: string
          subtitle: string
          synopsis: string
          title: string
          year: number
        }[]
      }
      log_media: {
        Args: {
          p_contains_spoilers?: boolean
          p_is_revisit?: boolean
          p_logged_at?: string
          p_media_slug: string
          p_rating?: number
          p_review_body?: string
          p_review_title?: string
        }
        Returns: Json
      }
      materialize_media_item: {
        Args: {
          p_average_rating: number
          p_backdrop_url: string
          p_content_hash: string
          p_details: Json
          p_external_id: string
          p_genres: string[]
          p_kind: Database["public"]["Enums"]["media_kind"]
          p_normalization_version: string
          p_poster_url: string
          p_source: string
          p_subtitle: string
          p_synopsis: string
          p_title: string
          p_year: number
        }
        Returns: Json
      }
      media_items_search_document: {
        Args: {
          p_details: Json
          p_genres: string[]
          p_subtitle: string
          p_synopsis: string
          p_title: string
        }
        Returns: unknown
      }
      remove_list_item: {
        Args: { p_list_id: string; p_media_slug: string }
        Returns: Json
      }
      semantic_search: {
        Args: {
          p_dimensions: number
          p_document_version: string
          p_kind?: Database["public"]["Enums"]["media_kind"]
          p_limit?: number
          p_max_distance?: number
          p_model: string
          p_provider: string
          p_query_embedding: string
        }
        Returns: {
          average_rating: number
          backdrop_url: string
          details: Json
          genres: string[]
          kind: Database["public"]["Enums"]["media_kind"]
          media_id: string
          poster_url: string
          rank: number
          slug: string
          subtitle: string
          synopsis: string
          title: string
          year: number
        }[]
      }
      set_favorite: {
        Args: { p_is_favorite: boolean; p_media_slug: string }
        Returns: Json
      }
      update_diary_entry: {
        Args: {
          p_contains_spoilers?: boolean
          p_diary_entry_id: string
          p_is_revisit?: boolean
          p_logged_at?: string
          p_rating?: number
          p_review_body?: string
          p_review_title?: string
        }
        Returns: Json
      }
      update_list: {
        Args: {
          p_description?: string
          p_is_ranked?: boolean
          p_list_id: string
          p_title: string
          p_visibility?: string
        }
        Returns: Json
      }
    }
    Enums: {
      list_visibility: "public" | "followers" | "private"
      media_kind: "movie" | "tv" | "book"
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
      list_visibility: ["public", "followers", "private"],
      media_kind: ["movie", "tv", "book"],
    },
  },
} as const

