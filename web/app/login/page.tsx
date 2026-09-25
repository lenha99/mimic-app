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
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const oauthError = params.get("error");
  const reason = params.get("reason");

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
    const problem = checkUsername(id) ?? checkPassword(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("비밀번호 두 번이 서로 달라요.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: id, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "가입에 실패했어요. 잠시 후 다시 시도해주세요.");
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
            ? "아이디나 비밀번호가 맞지 않아요."
            : "로그인에 실패했어요. 잠시 후 다시 시도해주세요.",
        );
        return;
      }

      // 프로필에서 로그인 전에 저장한 녹음을 이 계정으로 가져온다 (claim-pending).
      router.replace("/profile");
      router.refresh();
    } catch {
      setError("네트워크가 끊겼어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const signInWith = (provider: "kakao" | "google") =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  const signup = mode === "signup";

  return (
    <main className="shell">
      <BackHome />
      <div className={styles.center}>
        <div className="logo">🎙 MIMIC</div>
        <h1 className={styles.title}>{signup ? "회원가입" : "로그인"}</h1>
        <p className={styles.sub}>
          {signup
            ? "아이디랑 비밀번호만 있으면 돼요. 이메일은 안 받아요."
            : "공개·투표·캐릭터 꾸미기는 로그인하면 열려요."}
        </p>

        {oauthError && (
          <p className={styles.error}>
            로그인에 실패했어요. 다시 시도해주세요.
            {reason && <span className={styles.reason}>{reason}</span>}
          </p>
        )}

        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.field}>
            <span>아이디</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              placeholder="영어 소문자·숫자·_ 3~20자"
              required
            />
          </label>
          <label className={styles.field}>
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={`${PASSWORD_MIN}자 이상`}
              required
            />
          </label>
          {signup && (
            <label className={styles.field}>
              <span>비밀번호 확인</span>
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
            {busy ? "잠깐만요…" : signup ? "가입하고 시작하기" : "로그인"}
          </button>
          {signup && (
            <p className={styles.hint}>비밀번호 찾기가 없어요. 잊지 않게 적어두세요.</p>
          )}
        </form>

        <p className={styles.switch}>
          {signup ? "이미 아이디가 있어요 · " : "처음이에요 · "}
          <button type="button" onClick={() => switchMode(signup ? "login" : "signup")}>
            {signup ? "로그인" : "회원가입"}
          </button>
        </p>

        {SOCIAL_LOGIN_READY && (
          <>
            <p className={styles.or}>또는</p>
            <button onClick={() => signInWith("kakao")} className={styles.kakao}>
              카카오로 시작하기
            </button>
            <button onClick={() => signInWith("google")} className={styles.google}>
              Google로 시작하기
            </button>
          </>
        )}
      </div>
    </main>
  );
}
