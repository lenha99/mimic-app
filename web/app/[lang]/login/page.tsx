"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BackHome } from "@/components/back-home";
import {
  checkPassword,
  checkUsername,
  normalizeUsername,
  PASSWORD_MIN,
  usernameToEmail,
} from "@/lib/id-account";
import { createClient } from "@/lib/supabase/client";
import { NICK_MAX, nicknameProblem } from "@/lib/nickname";
import { useLang, useT } from "@/components/lang";
import styles from "./login.module.css";

/**
 * 카카오·구글 버튼은 콘솔 설정(카카오 로그인 활성화, Supabase 리다이렉트 허용 목록)이
 * 끝날 때까지 숨긴다. 누르면 실패하는 버튼은 없는 버튼보다 나쁘다.
 */
const SOCIAL_LOGIN_READY = false;

type Mode = "login" | "signup";

/** TODO(Dev A): 약관 동의 UI. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useT();
  const lang = useLang();
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const oauthError = params.get("error");
  const reason = params.get("reason");
  // 피드에서 반응하려다 온 사람은 보던 장으로 돌려보낸다. 내부 경로만 — "//evil.com" 은
  // 브라우저가 다른 사이트로 읽는다 (auth/callback 의 safeNext 와 같은 규칙).
  const rawNext = params.get("next");
  // "/\evil.com" 도 브라우저는 "//evil.com" 으로 읽는다.
  const next = rawNext && /^\/(?![/\\])/.test(rawNext) ? rawNext : null;

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = normalizeUsername(username);
    const problem = checkUsername(id, lang) ?? checkPassword(password, lang);
    if (problem) {
      setError(problem);
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError(t("비밀번호 두 번이 서로 달라요.", "Passwords don't match."));
      return;
    }
    if (mode === "signup" && nickname.trim() && nicknameProblem(nickname, lang)) {
      setError(nicknameProblem(nickname, lang));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: id, password, nickname: nickname.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? t("가입이 안 됐어요. 잠시 후 다시 시도해 주세요.", "Sign-up failed. Please try again shortly."));
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(id),
        password,
      });
      if (signInError) {
        setError(
          /invalid/i.test(signInError.message)
            ? t("아이디나 비밀번호가 맞지 않아요.", "Wrong username or password.")
            : t("로그인이 안 됐어요. 잠시 후 다시 시도해 주세요.", "Login failed. Please try again shortly."),
        );
        return;
      }

      // 기본은 홈 — 로그인한 홈 맨 위에 "오늘은 뭐 해볼까?"와 할 일이 뜨고, 로그인 전에
      // 저장한 녹음도 거기서 이 계정으로 가져온다 (components/viewer-welcome).
      router.replace(next ?? "/");
      router.refresh();
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요.", "Connection dropped. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const signInWith = (provider: "kakao" | "google") =>
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });

  const signup = mode === "signup";

  return (
    <main className="shell">
      <BackHome />
      <div className={styles.center}>
        <div className="logo">🎙 MIMIC</div>
        <h1 className={styles.title}>{signup ? t("회원가입", "Sign up") : t("로그인", "Log in")}</h1>
        <p className={styles.sub}>
          {signup
            ? t("아이디랑 비밀번호만 있으면 돼요. 이메일은 안 받아요.", "Just a username and password. No email needed.")
            : t("로그인하면 공개·투표·캐릭터 꾸미기까지 다 열려요.", "Log in to post, vote and customize your character.")}
        </p>

        {oauthError && (
          <p className={styles.error}>
            {t("로그인이 안 됐어요. 다시 시도해 주세요.", "Login failed. Please try again.")}
            {reason && <span className={styles.reason}>{reason}</span>}
          </p>
        )}

        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.field}>
            <span>{t("아이디", "Username")}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              placeholder={t("영어 소문자·숫자·_ 3~20자", "3–20 lowercase letters, numbers, _")}
              required
            />
          </label>
          <label className={styles.field}>
            <span>{t("비밀번호", "Password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={t(`${PASSWORD_MIN}자 이상`, `${PASSWORD_MIN}+ characters`)}
              required
            />
          </label>
          {signup && (
            <label className={styles.field}>
              <span>{t("닉네임 (순위·게시판에 보이는 이름)", "Nickname (shown on rankings & boards)")}</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
                maxLength={NICK_MAX}
                placeholder={t("비워 두면 아이디로 · 나중에 바꿀 수 있어요", "Defaults to your username · change anytime")}
              />
            </label>
          )}
          {signup && (
            <label className={styles.field}>
              <span>{t("비밀번호 확인", "Confirm password")}</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? t("잠깐만요…", "One sec…") : signup ? t("가입하고 시작하기 🎤", "Sign up & start 🎤") : t("로그인", "Log in")}
          </button>
          {signup && (
            <p className={styles.hint}>{t("비밀번호 찾기가 없어요. 잊지 않게 꼭 적어 두세요!", "There's no password reset — write it down somewhere safe!")}</p>
          )}
        </form>

        <p className={styles.switch}>
          {signup ? t("이미 아이디가 있어요 · ", "Already have an account? · ") : t("처음이에요 · ", "New here? · ")}
          <button type="button" onClick={() => switchMode(signup ? "login" : "signup")}>
            {signup ? t("로그인", "Log in") : t("회원가입", "Sign up")}
          </button>
        </p>

        {SOCIAL_LOGIN_READY && (
          <>
            <p className={styles.or}>{t("또는", "or")}</p>
            <button onClick={() => signInWith("kakao")} className={styles.kakao}>
              {t("카카오로 시작하기", "Continue with Kakao")}
            </button>
            <button onClick={() => signInWith("google")} className={styles.google}>
              {t("Google로 시작하기", "Continue with Google")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
