/**
 * PLACEHOLDER — NOT YET CLI-GENERATED.
 *
 * The canonical way to produce this file is:
 *
 *     npm run supabase:types
 *
 * which runs `supabase gen types typescript --local` against the running local
 * database. That command requires Docker, which was unavailable in the
 * environment where this foundation was created, so this file was authored by
 * hand to match the migrations in `supabase/migrations/` exactly. It MUST be
 * regenerated (overwriting this content) as soon as a local Supabase stack can
 * run, and should not be hand-maintained thereafter.
 *
 * This type is intentionally the *database* representation only. It is NOT the
 * Favalog domain model — see `lib/supabase/mappers.ts` for the boundary that
 * maps these rows into the framework-agnostic types in `lib/types.ts`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          location: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          bio?: string | null;
          location?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          bio?: string | null;
          location?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_items: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["media_kind"];
          source: string;
          external_id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          synopsis: string;
          year: number;
          poster_url: string | null;
          backdrop_url: string | null;
          average_rating: number | null;
          genres: string[];
          details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["media_kind"];
          source?: string;
          external_id: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          synopsis?: string;
          year: number;
          poster_url?: string | null;
          backdrop_url?: string | null;
          average_rating?: number | null;
          genres?: string[];
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: Database["public"]["Enums"]["media_kind"];
          source?: string;
          external_id?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          synopsis?: string;
          year?: number;
          poster_url?: string | null;
          backdrop_url?: string | null;
          average_rating?: number | null;
          genres?: string[];
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      diary_entries: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          logged_at: string;
          rating: number | null;
          is_revisit: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          logged_at?: string;
          rating?: number | null;
          is_revisit?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          logged_at?: string;
          rating?: number | null;
          is_revisit?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diary_entries_media_id_fkey";
            columns: ["media_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diary_entries_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          diary_entry_id: string | null;
          title: string | null;
          body: string;
          rating: number | null;
          contains_spoilers: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          diary_entry_id?: string | null;
          title?: string | null;
          body: string;
          rating?: number | null;
          contains_spoilers?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          diary_entry_id?: string | null;
          title?: string | null;
          body?: string;
          rating?: number | null;
          contains_spoilers?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_diary_entry_id_fkey";
            columns: ["diary_entry_id"];
            referencedRelation: "diary_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_media_id_fkey";
            columns: ["media_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          title: string;
          description: string | null;
          is_ranked: boolean;
          visibility: Database["public"]["Enums"]["list_visibility"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          title: string;
          description?: string | null;
          is_ranked?: boolean;
          visibility?: Database["public"]["Enums"]["list_visibility"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          is_ranked?: boolean;
          visibility?: Database["public"]["Enums"]["list_visibility"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          media_id: string;
          position: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          media_id: string;
          position: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          media_id?: string;
          position?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey";
            columns: ["list_id"];
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_items_media_id_fkey";
            columns: ["media_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_media_id_fkey";
            columns: ["media_id"];
            referencedRelation: "media_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      media_kind: "movie" | "tv" | "book";
      list_visibility: "public" | "followers" | "private";
    };
    CompositeTypes: Record<never, never>;
  };
};
