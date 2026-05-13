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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_score_proposal_votes: {
        Row: {
          created_at: string | null
          id: string
          proposal_id: string
          updated_at: string | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          proposal_id: string
          updated_at?: string | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string | null
          id?: string
          proposal_id?: string
          updated_at?: string | null
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_score_proposal_votes_proposal_id_fkey'
            columns: ['proposal_id']
            isOneToOne: false
            referencedRelation: 'match_score_proposals'
            referencedColumns: ['id']
          },
        ]
      }
      match_score_proposals: {
        Row: {
          away_penalties: number | null
          away_score: number
          created_at: string | null
          expires_at: string
          home_penalties: number | null
          home_score: number
          id: string
          match_id: string
          proposed_by_user_id: string
          status: string
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          away_penalties?: number | null
          away_score: number
          created_at?: string | null
          expires_at?: string
          home_penalties?: number | null
          home_score: number
          id?: string
          match_id: string
          proposed_by_user_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string | null
        }
        Update: {
          away_penalties?: number | null
          away_score?: number
          created_at?: string | null
          expires_at?: string
          home_penalties?: number | null
          home_score?: number
          id?: string
          match_id?: string
          proposed_by_user_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'match_score_proposals_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_score_proposals_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          away_participant_id: string | null
          away_penalties: number | null
          away_score: number | null
          home_participant_id: string | null
          home_penalties: number | null
          home_score: number | null
          id: string
          playoff_leg: number | null
          playoff_pair_index: number | null
          round: number | null
          status: string | null
          tournament_id: string | null
          updated_at: string | null
        }
        Insert: {
          away_participant_id?: string | null
          away_penalties?: number | null
          away_score?: number | null
          home_participant_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          id?: string
          playoff_leg?: number | null
          playoff_pair_index?: number | null
          round?: number | null
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
        }
        Update: {
          away_participant_id?: string | null
          away_penalties?: number | null
          away_score?: number | null
          home_participant_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          id?: string
          playoff_leg?: number | null
          playoff_pair_index?: number | null
          round?: number | null
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_participant_id_fkey"
            columns: ["away_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_participant_id_fkey"
            columns: ["home_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          id: string
          joined_at: string | null
          team_name: string | null
          tournament_id: string | null
          user_id: string | null
          penalty_points: number | null
          penalty_reason: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          team_name?: string | null
          tournament_id?: string | null
          user_id?: string | null
          penalty_points?: number | null
          penalty_reason?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          team_name?: string | null
          tournament_id?: string | null
          user_id?: string | null
          penalty_points?: number | null
          penalty_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          nickname: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          nickname?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          nickname?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string | null
          creator_id: string
          game_type: string | null
          id: string
          invite_code: string
          name: string
          settings: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          game_type?: string | null
          id?: string
          invite_code: string
          name: string
          settings?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          game_type?: string | null
          id?: string
          invite_code?: string
          name?: string
          settings?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_creator_id_fkey"
            columns: ["creator_id"]
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
      finalize_match_score_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
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
