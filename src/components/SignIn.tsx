import { ArrowRight, GoogleLogo, Warning } from '@phosphor-icons/react';
import { memo, useState } from 'react';

import { useTranslation } from '../i18n/context';
import { isGoogleEnabled, supabase } from '../state/supabase';
import { BrandMark } from './BrandMark';
import './SignIn.css';

interface SignInProps {
  /** Lets a student use the app without an account, on this browser only. */
  onSkip: () => void;
}

type Mode = 'signIn' | 'signUp';

/**
 * The account screen.
 *
 * Signing in is optional by design: without it the app still works on
 * localStorage, so a student who cannot get into their email in the middle of
 * a lab is not locked out of the lesson.
 */
export const SignIn = memo(function SignIn({ onSkip }: SignInProps) {
  const { d } = useTranslation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!supabase || busy) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'signUp') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // The database trigger reads these into the profile row, so the
          // name exists from the very first sign-in.
          options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
        });
        if (signUpError) throw signUpError;
        // Projects that require confirmation return no session, so say what
        // happens next rather than appearing to do nothing.
        setNotice(d.auth.checkEmail);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : '';
      // Supabase reports these in English; the common ones get a translated
      // explanation and anything else falls back to its own wording.
      if (/invalid login credentials/i.test(message)) setError(d.auth.wrongCredentials);
      else if (/already registered|already exists/i.test(message)) setError(d.auth.alreadyExists);
      else if (/password/i.test(message) && /6|short|least/i.test(message)) {
        setError(d.auth.passwordTooShort);
      } else setError(message || d.auth.genericError);
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async (): Promise<void> => {
    if (!supabase) return;
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Comes back to wherever the app is served from, so this works the same
      // on localhost and on the published site.
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <div className="signin">
      <div className="signin__panel">
        <div className="signin__brand">
          <BrandMark size={26} className="signin__mark" />
          <span>{d.app.name}</span>
        </div>

        <h1 className="signin__title">
          {mode === 'signIn' ? d.auth.signInTitle : d.auth.signUpTitle}
        </h1>
        <p className="signin__subtitle">
          {mode === 'signIn' ? d.auth.signInBody : d.auth.signUpBody}
        </p>

        <form className="signin__form" onSubmit={(event) => void submit(event)}>
          {mode === 'signUp' && (
            <div className="signin__row">
              <label className="signin__field">
                <span>{d.auth.firstName}</span>
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={d.auth.firstNameHint}
                />
              </label>
              <label className="signin__field">
                <span>{d.auth.lastName}</span>
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder={d.auth.lastNameHint}
                />
              </label>
            </div>
          )}

          <label className="signin__field">
            <span>{d.auth.email}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.edu"
            />
          </label>

          <label className="signin__field">
            <span>{d.auth.password}</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={d.auth.passwordHint}
            />
          </label>

          {error && (
            <p className="signin__error">
              <Warning weight="fill" aria-hidden="true" />
              {error}
            </p>
          )}
          {notice && <p className="signin__notice">{notice}</p>}

          <button type="submit" className="signin__submit" disabled={busy}>
            {busy ? d.auth.working : mode === 'signIn' ? d.auth.signIn : d.auth.signUp}
            {!busy && <ArrowRight weight="bold" />}
          </button>
        </form>

        {isGoogleEnabled && (
          <>
            <div className="signin__divider">
              <span>{d.auth.or}</span>
            </div>
            <button type="button" className="signin__google" onClick={() => void withGoogle()}>
              <GoogleLogo weight="bold" />
              {d.auth.withGoogle}
            </button>
          </>
        )}

        <p className="signin__switch">
          {mode === 'signIn' ? d.auth.noAccount : d.auth.haveAccount}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setNotice(null);
            }}
          >
            {mode === 'signIn' ? d.auth.signUp : d.auth.signIn}
          </button>
        </p>

        <button type="button" className="signin__skip" onClick={onSkip}>
          {d.auth.continueWithout}
        </button>
      </div>
    </div>
  );
});

