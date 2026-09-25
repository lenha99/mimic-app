/**
 * 손으로 작성한 임시 타입. Supabase 프로젝트에 마이그레이션 적용 후
 * `supabase gen types typescript --project-id <ref> > web/types/database.ts` 로 덮어써야 함.
 * (공통 파일 — CLAUDE.md의 "공통 파일" 규칙 확인)
 */
/** profiles.avatar — 모르는 키는 DB check 제약이 거부한다. */
export type AvatarJson = Partial<
  Record<"body" | "color" | "eyes" | "hair" | "hairColor" | "face" | "glasses" | "hat" | "fx", string>
>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          avatar_emoji: string;
          /** 목소리 캐릭터 모양. 허용 값은 lib/avatar.ts 와 DB check 제약이 같이 지킨다. */
          avatar: AvatarJson;
          provider: string;
          created_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          avatar_emoji?: string;
          avatar?: AvatarJson;
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
          /** 비공개 버킷 안 경로. 재생 URL 은 서버가 서명해서 만든다 (lib/audio-url.ts). */
          audio_path: string;
          score: number | null;
          grade: string | null;
          pitch: number | null;
          tone: number | null;
          timing: number | null;
          elo_rating: number;
          is_public: boolean;
          /** 신고로 숨김. 주인이 is_public 을 켜도 안 보인다. service_role 만 푼다. */
          hidden: boolean;
          // service_role 전용 — anon/authenticated 키는 이 컬럼의 SELECT 권한이
          // 없다(마이그레이션 …0011). 게스트 귀속은 claim_recording() RPC로 한다.
          claim_token: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          meme_id: string;
          audio_path: string;
          // score/grade/pitch/tone/timing은 여기 타입이 아니라 DB의 RLS/트리거가 막는다 —
          // 익명/authenticated 키로는 null 아니면 insert/update 자체가 거부된다.
          // service_role(예: /api/publish-recording)만 실제 값을 쓸 수 있다 (이슈 #23).
          score?: number | null;
          grade?: string | null;
          pitch?: number | null;
          tone?: number | null;
          timing?: number | null;
          // elo_rating도 같은 이유로 클라이언트가 못 정한다 — 초안 insert는 1200만
          // 허용되고, 이후 갱신은 투표 트리거(apply_vote_elo)만 할 수 있다.
          elo_rating?: number;
          is_public?: boolean;
          hidden?: boolean;
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
          avatar: AvatarJson;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_vote_matchup: {
        Args: { p_exclude_user?: string | null };
        Returns: { meme_id: string; id: string; audio_path: string; user_id: string | null }[];
      };
      /** 게스트 녹음을 로그인 계정에 귀속. 토큰은 1회용이라 성공 시 소각된다. */
      claim_recording: {
        Args: { p_claim_token: string };
        Returns: string;
      };
      /** 게스트는 user_id가 없어 자기 녹음을 select로 못 읽는다 — 토큰으로 조회. */
      get_guest_recording: {
        Args: { p_claim_token: string };
        Returns: {
          id: string;
          meme_id: string;
          audio_path: string;
          score: number | null;
          grade: string | null;
          is_public: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
