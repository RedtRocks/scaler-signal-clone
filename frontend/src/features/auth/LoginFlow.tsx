"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarCropper, Button, COUNTRIES, Icon, OtpInput, PhoneInput, Spinner, TextField, toE164 } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { Splash } from "@/features/shell/Splash";
import { bootstrap, useAuthStore, useSession } from "@/store";
import { RESEND_SECONDS, formatPhoneForDisplay, isPlausibleNational } from "./otp";
import styles from "./LoginFlow.module.css";

type Step = "phone" | "otp";

const NAME_MAX = 50;
const ABOUT_MAX = 140;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.status === 0 ? "Can't reach the server. Check your connection." : error.detail;
  return fallback;
}

/** Phone number -> OTP -> profile (new users) -> the app. */
export function LoginFlow() {
  const router = useRouter();
  const { status, me, needsProfile } = useSession();

  useEffect(() => {
    if (status === "signedIn" && me && !needsProfile) router.replace("/");
  }, [status, me, needsProfile, router]);

  // Signed in and settled: the redirect above is on its way.
  if (status === "unknown" || (status === "signedIn" && !me)) return <Splash />;
  if (status === "signedIn" && !needsProfile) return <Splash />;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVGs, swapped by theme in CSS */}
        <img className={`${styles.logo} ${styles.logoLight}`} src="/logos/Signal-Lockup-Ultramarine.svg" alt="Signal" width={200} height={57} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.logo} ${styles.logoDark}`} src="/logos/Signal-Lockup-White.svg" alt="Signal" width={200} height={57} />
        {status === "signedIn" && needsProfile ? <ProfileStep /> : <SignInSteps />}
      </div>
    </main>
  );
}

function SignInSteps() {
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState("US");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [resent, setResent] = useState(false);

  const dial = COUNTRIES.find((c) => c.iso === country)?.dial ?? "+1";
  const phone = toE164(dial, national);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const sendCode = async (resend = false) => {
    if (!isPlausibleNational(national)) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await requestOtp(phone);
      setStep("otp");
      setCode("");
      setWait(RESEND_SECONDS);
      setResent(resend);
    } catch (e) {
      setError(messageOf(e, "Couldn't send the code. Try again."));
    }
    setBusy(false);
  };

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyOtp(phone, value);
      // Loads chats and connects the socket. A new User lands on the profile step via the session.
      await bootstrap();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? "Incorrect code. Try again." : messageOf(e, "Couldn't verify the code."));
      setCode("");
      setBusy(false);
    }
  };

  if (step === "otp") {
    return (
      <>
        <div className={styles.head}>
          <h1 className={styles.title}>Enter your verification code</h1>
          <p className={styles.subtitle}>
            We sent a code to {formatPhoneForDisplay(phone)}.{" "}
            <Button
              variant="link"
              onClick={() => {
                setStep("phone");
                setError("");
                setCode("");
              }}
              style={{ height: "auto", padding: 0 }}
            >
              Wrong number?
            </Button>
          </p>
        </div>
        <div className={styles.form}>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(""); }} onComplete={(v) => void verify(v)} error={error} disabled={busy} autoFocus />
          <p className={styles.hint}>Demo: the verification code is always 123456.</p>
          <div className={styles.actions}>
            <Button block disabled={busy || code.length < 6} onClick={() => void verify(code)}>
              {busy ? <Spinner size={16} inherit /> : null}
              Verify
            </Button>
            <Button variant="link" disabled={busy || wait > 0} onClick={() => void sendCode(true)}>
              {wait > 0 ? `Resend code in 0:${String(wait).padStart(2, "0")}` : "Resend code"}
            </Button>
            {resent && wait > 0 ? <p className={styles.footnote}>A new code was sent.</p> : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Your phone number</h1>
        <p className={styles.subtitle}>Enter your phone number to get started with Signal.</p>
      </div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
      >
        <PhoneInput
          country={country}
          onCountryChange={setCountry}
          value={national}
          onChange={(v) => {
            setNational(v);
            setError("");
          }}
          error={error}
          autoFocus
          disabled={busy}
        />
        <Button block type="submit" disabled={busy || !national.trim()}>
          {busy ? <Spinner size={16} inherit /> : null}
          Next
        </Button>
        <p className={styles.footnote}>
          Reviewer accounts (code 123456), each with its own chats:
          <br />
          {REVIEWER_ACCOUNTS.map((account) => (
            <Button
              key={account.national}
              variant="link"
              type="button"
              disabled={busy}
              onClick={() => {
                setCountry("US");
                setNational(account.national);
              }}
              style={{ height: "auto", padding: 0, marginRight: 12 }}
            >
              {account.name}
            </Button>
          ))}
          <br />
          Any other number starts fresh, with no chats.
        </p>
      </form>
    </>
  );
}

const REVIEWER_ACCOUNTS = [
  { name: "Aarav (+1 555 000 0001)", national: "5550000001" },
  { name: "Maya (+1 555 000 0002)", national: "5550000002" },
  { name: "Sunita (+1 555 000 0005)", national: "5550000005" },
];

function ProfileStep() {
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  /** The picture just chosen, waiting in the crop dialog. */
  const [toCrop, setToCrop] = useState<File | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return setError("Photos must be JPEG, PNG, WebP or GIF.");
    setError("");
    setToCrop(file);
  };

  const submit = async () => {
    const displayName = name.trim();
    if (!displayName) return setError("Enter your name.");
    setBusy(true);
    setError("");
    try {
      await saveProfile({ displayName, about: about.trim() || undefined, avatar: avatar ?? undefined });
      // The session now has a name; LoginFlow redirects to "/".
    } catch (e) {
      setError(messageOf(e, "Couldn't save your profile. Try again."));
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Your profile</h1>
        <p className={styles.subtitle}>Signal profiles are visible to people you message and your contacts.</p>
      </div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={styles.center}>
          <button type="button" className={styles.avatarButton} aria-label="Choose a profile photo" onClick={() => fileRef.current?.click()}>
            <Avatar name={name || "?"} src={preview ?? undefined} size={96} />
            <span className={styles.avatarBadge}>
              <Icon name="camera" size={18} />
            </span>
          </button>
          <input ref={fileRef} className={styles.fileInput} type="file" accept={AVATAR_TYPES.join(",")} onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <TextField
          label="Name"
          placeholder="Your name (required)"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          autoComplete="name"
          trailing={`${name.length}/${NAME_MAX}`}
          error={error && !name.trim() ? error : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
        <TextField
          label="About (optional)"
          placeholder="Say something about yourself"
          value={about}
          maxLength={ABOUT_MAX}
          onChange={(e) => setAbout(e.target.value)}
        />
        {toCrop ? (
          <AvatarCropper
            file={toCrop}
            onCancel={() => setToCrop(null)}
            onDone={(cropped) => {
              setToCrop(null);
              setAvatar(cropped);
            }}
          />
        ) : null}
        {error && name.trim() ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <Button block type="submit" disabled={busy || !name.trim()}>
          {busy ? <Spinner size={16} inherit /> : null}
          Finish
        </Button>
      </form>
    </>
  );
}
