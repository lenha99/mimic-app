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
          /** 메시지 받기 — 구독자만 / 끄기 (마이그레이션 24) */
          dm_policy: "followers" | "off";
        };
        Insert: {
          id: string;
          nickname: string;
          avatar_emoji?: string;
          avatar?: AvatarJson;
          provider: string;
          created_at?: string;
          dm_policy?: "followers" | "off";
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
          /** 링크를 가진 사람만 듣는 녹음 (/p/{id}). 투표·랭킹엔 안 오른다. */
          shared: boolean;
          /** 녹음할 때의 캐릭터. 게스트도 링크에서 자기 캐릭터로 나오게. */
          avatar: AvatarJson | null;
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
          shared?: boolean;
          avatar?: AvatarJson | null;
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
      /**
       * 피드 반응. 행은 본인 것만 읽힌다(개수는 feed_page 가 센다).
       * 공개된 남의 녹음에만 누를 수 있다 — RLS 가 막는다.
       */
      reactions: {
        Row: {
          recording_id: string;
          user_id: string;
          kind: "same" | "funny";
          created_at: string;
        };
        Insert: {
          recording_id: string;
          user_id: string;
          kind: "same" | "funny";
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      /** 사용자 챌린지. 기준 음성은 Modal 볼륨 {id}.wav. 쓰기는 서버(service_role)만. */
      challenges: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          line: string | null;
          emoji: string;
          duration_ms: number | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id: string;
          creator_id: string;
          title: string;
          line?: string | null;
          emoji?: string;
          duration_ms?: number | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
        Relationships: [];
      };
      /** 연습 피드백 게시판 — 본인이 골라 올린 연습 테이크. 쓰기·읽기는 서버(service_role)만. */
      practice_posts: {
        Row: {
          id: string;
          user_id: string;
          script_id: string;
          title: string;
          script_text: string;
          track: "voice" | "anchor" | "line";
          ask: string | null;
          audio_path: string;
          hidden: boolean;
          reports: number;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          script_id: string;
          title: string;
          script_text: string;
          track: "voice" | "anchor" | "line";
          ask?: string | null;
          audio_path: string;
          hidden?: boolean;
          reports?: number;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["practice_posts"]["Insert"]>;
        Relationships: [];
      };
      practice_notes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          tags: string[];
          body: string;
          hidden: boolean;
          reports: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          tags?: string[];
          body: string;
          hidden?: boolean;
          reports?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["practice_notes"]["Insert"]>;
        Relationships: [];
      };
      practice_reports: {
        Row: { user_id: string; post_id: string | null; note_id: string | null; created_at: string };
        Insert: { user_id: string; post_id?: string | null; note_id?: string | null; created_at?: string };
        Update: never;
        Relationships: [];
      };
      /** 운영자 계정. 읽기는 서버(service_role)만. */
      admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      /** 결과 화면 한 줄 피드백. 로그인 없이도 남는다. */
      app_feedback: {
        Row: {
          id: string;
          user_id: string | null;
          client_id: string | null;
          page: "record" | "practice" | "board";
          item_id: string | null;
          rating: -1 | 1;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_id?: string | null;
          page: "record" | "practice" | "board";
          item_id?: string | null;
          rating: -1 | 1;
          message?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      /** 주간 보이스 챌린지 (마이그레이션 20). 읽기·쓰기는 서버(service_role)만. */
      weekly_challenges: {
        Row: {
          id: string;
          season: number;
          script_id: string;
          field: string;
          title: string;
          starts_at: string;
          ends_at: string;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          season: number;
          script_id: string;
          field: string;
          title: string;
          starts_at: string;
          ends_at: string;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_challenges"]["Insert"]>;
        Relationships: [];
      };
      weekly_entries: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string | null;
          owner: string;
          claim_token: string | null;
          guest_name: string | null;
          avatar: AvatarJson;
          audio_path: string;
          duration_s: number;
          bars: number[];
          like_count: number;
          play_count: number;
          hidden: boolean;
          reports: number;
          created_at: string;
          updated_at: string;
          /** 블라인드 배틀 Elo (마이그레이션 23) */
          battle_rating: number;
          battle_wins: number;
          battle_losses: number;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id?: string | null;
          owner: string;
          claim_token?: string | null;
          guest_name?: string | null;
          avatar?: AvatarJson;
          audio_path: string;
          duration_s: number;
          bars?: number[];
          like_count?: number;
          play_count?: number;
          hidden?: boolean;
          reports?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_entries"]["Insert"]>;
        Relationships: [];
      };
      weekly_battle_votes: {
        Row: {
          id: number;
          challenge_id: string;
          pair: string;
          winner_id: string;
          loser_id: string;
          voter: string;
          user_id: string | null;
          ip_hash: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      voice_follows: {
        Row: { follower: string; creator: string; created_at: string };
        Insert: { follower: string; creator: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      dm_threads: {
        Row: { id: string; a: string; b: string; requester: string; status: "request" | "open" | "declined"; last_at: string; created_at: string };
        Insert: { id?: string; a: string; b: string; requester: string; status?: "request" | "open" | "declined"; last_at?: string; created_at?: string };
        Update: { status?: "request" | "open" | "declined"; last_at?: string; requester?: string };
        Relationships: [];
      };
      dm_messages: {
        Row: { id: number; thread_id: string; sender: string; body: string; created_at: string; read_at: string | null };
        Insert: { thread_id: string; sender: string; body: string; created_at?: string; read_at?: string | null };
        Update: { read_at?: string | null };
        Relationships: [];
      };
      dm_blocks: {
        Row: { blocker: string; blocked: string; created_at: string };
        Insert: { blocker: string; blocked: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: number;
          user_id: string;
          kind: NotificationKind;
          actor: string | null;
          entry_id: string | null;
          thread_id: string | null;
          count: number | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          user_id: string;
          kind: NotificationKind;
          actor?: string | null;
          entry_id?: string | null;
          thread_id?: string | null;
          count?: number | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: { read_at?: string | null };
        Relationships: [];
      };
      push_subs: {
        Row: { endpoint: string; user_id: string | null; client: string | null; p256dh: string; auth: string; new_entries: boolean; created_at: string };
        Insert: { endpoint: string; user_id?: string | null; client?: string | null; p256dh: string; auth: string; new_entries?: boolean; created_at?: string };
        Update: { user_id?: string | null; client?: string | null; p256dh?: string; auth?: string; new_entries?: boolean };
        Relationships: [];
      };
      notif_sent: {
        Row: { key: string; sent_at: string };
        Insert: { key: string; sent_at?: string };
        Update: never;
        Relationships: [];
      };
      entry_listens: {
        Row: { entry_id: string; listener: string; created_at: string };
        Insert: { entry_id: string; listener: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      weekly_likes: {
        Row: { entry_id: string; voter: string; user_id: string | null; ip_hash: string; created_at: string };
        Insert: { entry_id: string; voter: string; user_id?: string | null; ip_hash: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      weekly_reports: {
        Row: { entry_id: string; user_id: string; created_at: string };
        Insert: { entry_id: string; user_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      weekly_awards: {
        Row: {
          challenge_id: string;
          place: number;
          entry_id: string | null;
          user_id: string | null;
          name: string;
          avatar: AvatarJson;
          likes: number;
        };
        Insert: {
          challenge_id: string;
          place: number;
          entry_id?: string | null;
          user_id?: string | null;
          name: string;
          avatar?: AvatarJson;
          likes: number;
        };
        Update: { user_id?: string | null };
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
      /** 피드 한 페이지 — 공개 녹음 + 반응 개수 + 내가 누른 반응. p_pin 은 첫 장 고정. */
      feed_page: {
        Args: {
          p_sort?: "hot" | "new" | "funny";
          p_offset?: number;
          p_limit?: number;
          p_pin?: string | null;
        };
        Returns: {
          id: string;
          meme_id: string;
          audio_path: string;
          score: number | null;
          grade: string | null;
          created_at: string;
          user_id: string | null;
          nickname: string | null;
          avatar: AvatarJson | null;
          same_count: number;
          funny_count: number;
          my_same: boolean;
          my_funny: boolean;
          pinned: boolean;
        }[];
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
      /** ❤ 넣기 — 중복·네트워크 상한을 한 트랜잭션에서 (마이그레이션 21). */
      weekly_like: {
        Args: { p_entry: string; p_voters: string[]; p_user: string | null; p_ip_hash: string; p_cap: number };
        Returns: "ok" | "dup" | "cap";
      };
      weekly_battle_vote: {
        Args: {
          p_week: string;
          p_winner: string;
          p_loser: string;
          p_voters: string[];
          p_user: string | null;
          p_ip_hash: string;
          p_cap: number;
        };
        Returns: "ok" | "dup" | "cap";
      };
      weekly_bump_play: {
        Args: { p_entry: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type NotificationKind = "follow" | "dm" | "dm_request" | "listen_first" | "listen_daily" | "new_entry";
