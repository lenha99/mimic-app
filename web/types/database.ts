/**
 * 손으로 작성한 임시 타입. Supabase 프로젝트에 마이그레이션 적용 후
 * `supabase gen types typescript --project-id <ref> > web/types/database.ts` 로 덮어써야 함.
 * (공통 파일 — CLAUDE.md의 "공통 파일" 규칙 확인)
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          avatar_emoji: string;
          provider: string;
          created_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          avatar_emoji?: string;
          provider: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      memes: {
        Row: {
          id: string;
          title: string;
          source: string | null;
          emoji: string;
          ref_audio_url: string | null;
          plays: number;
          created_at: string;
        };
        Insert: {
          id: string;
          title: string;
          source?: string | null;
          emoji?: string;
          ref_audio_url?: string | null;
          plays?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["memes"]["Insert"]>;
        Relationships: [];
      };
      recordings: {
        Row: {
          id: string;
          user_id: string | null;
          meme_id: string;
          audio_url: string;
          score: number | null;
          grade: string | null;
          pitch: number | null;
          tone: number | null;
          timing: number | null;
          elo_rating: number;
          is_public: boolean;
          claim_token: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          meme_id: string;
          audio_url: string;
          // score/grade/pitch/tone/timing은 여기 타입이 아니라 DB의 RLS/트리거가 막는다 —
          // 익명/authenticated 키로는 null 아니면 insert/update 자체가 거부된다.
          // service_role(예: /api/publish-recording)만 실제 값을 쓸 수 있다 (이슈 #23).
          score?: number | null;
          grade?: string | null;
          pitch?: number | null;
          tone?: number | null;
          timing?: number | null;
          elo_rating?: number;
          is_public?: boolean;
          claim_token?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recordings"]["Insert"]>;
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          meme_id: string;
          recording_a_id: string;
          recording_b_id: string;
          winner_id: string | null;
          voter_id: string | null;
          anon_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meme_id: string;
          recording_a_id: string;
          recording_b_id: string;
          winner_id?: string | null;
          voter_id?: string | null;
          anon_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          recording_id: string;
          reporter_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recording_id: string;
          reporter_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      rankings: {
        Row: {
          user_id: string;
          meme_id: string;
          wins: number;
          losses: number;
          elo_rating: number;
          nickname: string;
          avatar_emoji: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_vote_matchup: {
        Args: { p_exclude_user?: string | null };
        Returns: { meme_id: string; id: string; audio_url: string; user_id: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
