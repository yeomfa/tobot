import {
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
  GoogleLogoIcon as GoogleLogo,
  WarningIcon as Warning,
} from '@phosphor-icons/react';
import { memo, useEffect, useId, useRef, useState } from 'react';

import { useTranslation } from '../i18n/context';
import { ROUTES } from '../routes';
import { arrivalError, getSupabase, isGoogleEnabled } from '../state/supabase';
import { BrandMark } from './BrandMark';
import './SignIn.css';

interface SignInProps {
  /** Lets a student use the app without an account, on this browser only. */
  onSkip: () => void;
  /**
   * Set when a recovery link is what brought them here. The form then has one
   * job — take the new password — and the way out of it is doing that.
   */
  recovering?: boolean;
  /** Called once the new password is saved, so the gate can release. */
  onRecovered?: () => void;
}

/**
 * The four things this screen can be asking.
 *
 * `newPassword` is not something anyone chooses: it is where a recovery link
 * lands, and it is imposed rather than offered.
 */
type Mode = 'signIn' | 'signUp' | 'forgot' | 'newPassword';

/**
 * Where an auth provider should send the browser back to.
 *
 * Built from the address actually being visited rather than left to
 * Supabase's Site URL, which is a single value and therefore always wrong for
 * somewhere: set to localhost it breaks production, set to production it
 * breaks local development, and it cannot be both.
 *
 * Note that Supabase only honours a `redirect_to` it has been shown under
 * *Authentication → URL Configuration → Redirect URLs*. An address that is
 * not on that list is discarded in favour of the Site URL — silently, and
 * with a valid token attached, so it looks like the app asked for the wrong
 * place when it did not.
 *
 * The path is an argument because the two errands want different landings.
 * Signing in returns to the library: someone who has just signed in wants
 * their work, not the page that invited them to sign in. A recovery link
 * returns to `/login`, because there is still a question to ask before they
 * get anywhere.
 */
function appUrl(path: string = ROUTES.library): string {
  return new URL(path, window.location.origin).href;
}

interface PasswordFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
}

/**
 * A password input with an eye on it.
 *
 * Visibility is owned by the field rather than by the form because each one is
 * a separate question. On the sign-up form, revealing what you typed and
 * revealing what you are checking it against are not the same request, and
 * answering both at once would defeat the point of asking twice.
 *
 * The button flips the input's `type` and nothing else. Swapping in a
 * different element would drop focus mid-word, and lose the password
 * manager's interest in a field it had already recognised.
 */
function PasswordField({ label, hint, value, onChange, autoComplete }: PasswordFieldProps) {
  const { d } = useTranslation();
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="signin__field">
      {/* A `for` rather than a wrapping label: the button lives next to the
          input, and inside a label a click on it would also be a click on the
          field it sits in. */}
      <label htmlFor={id}>{label}</label>
      <div className="signin__password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={6}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={hint}
        />
        <button
          type="button"
          className="signin__reveal"
          /* Labelled by what pressing it will do, and `aria-pressed` carries
             the state — without it the name flips underneath a screen reader
             with nothing to say why. */
          aria-label={visible ? d.auth.hidePassword : d.auth.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeSlash weight="bold" /> : <Eye weight="bold" />}
        </button>
      </div>
    </div>
  );
}

/**
 * The account screen.
 *
 * Signing in is optional by design: without it the app still works on
 * localStorage, so a student who cannot get into their email in the middle of
 * a lab is not locked out of the lesson.
 */
export const SignIn = memo(function SignIn({ onSkip, recovering, onRecovered }: SignInProps) {
  const { d } = useTranslation();
  /* What the student picked, and what the screen is actually doing. A recovery
     link overrides the choice rather than setting it, so there is no state to
     keep in step with the prop. */
  const [chosen, setChosen] = useState<Mode>('signIn');
  const mode: Mode = recovering ? 'newPassword' : chosen;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  /** Set once the new password is saved and the screen is on its way out. */
  const [done, setDone] = useState(false);
  const release = useRef<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    /* A link that has expired, or a refusal at Google's consent screen, is the
       one failure that arrives before anything is submitted. Read once here,
       or the form reappears as though the link had never been clicked. */
    const why = arrivalError();
    if (!why) return null;
    return /expired|invalid/i.test(why) ? d.auth.linkExpired : why;
  });

  // The timer outlives a fast unmount otherwise, and would call back into a
  // screen that has already gone.
  useEffect(
    () => () => {
      if (release.current !== null) window.clearTimeout(release.current);
    },
    [],
  );

  const goTo = (next: Mode): void => {
    setChosen(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;

    const supabase = await getSupabase();
    if (!supabase) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: appUrl(ROUTES.login),
        });
        if (resetError) throw resetError;
        /*
          Worded the same whether or not that address has an account. Supabase
          answers alike on purpose, and a form that said "no such account"
          would turn this page into a way of asking who has one — the same
          reason the sign-up form cannot simply say an address is taken.
        */
        setNotice(d.auth.resetSent);
        return;
      }

      if (mode === 'newPassword') {
        if (password !== confirmation) {
          setError(d.auth.passwordsDiffer);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice(d.auth.passwordUpdated);
        /*
          The link's session is an ordinary one from here on, so releasing the
          gate is what sends them to their work — which is also why it waits.
          Releasing it navigates away on the same frame that writes the
          confirmation, and a message replaced before it is painted may as
          well not have been written.

          `done` rather than leaving `busy` set: the work has finished, and
          what the button is now saying is that there is nothing left to press.
        */
        setDone(true);
        release.current = window.setTimeout(() => onRecovered?.(), 1400);
        return;
      }

      if (mode === 'signUp') {
        if (password !== confirmation) {
          setError(d.auth.passwordsDiffer);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // Comes back to the app rather than to whatever Supabase has as its
          // Site URL, which is what sent confirmation links to localhost.
          options: {
            emailRedirectTo: appUrl(),
            // The database trigger reads these into the profile row, so the
            // name exists from the very first sign-in.
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
          },
        });
        if (signUpError) throw signUpError;

        /*
          An address that is already registered comes back as success, with a
          user whose `identities` array is empty — Supabase does this
          deliberately so that a stranger cannot use the sign-up form to
          discover who has an account.

          The app has to read that, because the alternative is what happened
          here: someone re-registers an existing address, is told to check
          their email, and waits for a message that will never arrive.
        */
        if (data.user && data.user.identities?.length === 0) {
          setError(d.auth.alreadyExists);
          return;
        }

        // A session means the project has confirmation switched off and they
        // are already in; otherwise there is a message on the way.
        if (!data.session) setNotice(d.auth.checkEmail);
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
      // explanation and anything else falls back to its own wording. Order
      // matters: the specific readings have to run before the one that only
      // looks for the word "password".
      if (/invalid login credentials/i.test(message)) setError(d.auth.wrongCredentials);
      else if (/already registered|already exists/i.test(message)) setError(d.auth.alreadyExists);
      else if (/should be different|same.*password/i.test(message)) {
        setError(d.auth.passwordSameAsOld);
      } else if (/expired|session missing|invalid.*token|token.*invalid/i.test(message)) {
        setError(d.auth.linkExpired);
      } else if (/password/i.test(message) && /6|short|least/i.test(message)) {
        setError(d.auth.passwordTooShort);
      } else setError(message || d.auth.genericError);
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async (): Promise<void> => {
    const supabase = await getSupabase();
    if (!supabase) return;
    setError(null);

    const target = appUrl();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: target },
    });
    if (oauthError) {
      setError(oauthError.message);
      return;
    }

    /*
      Supabase silently drops a `redirect_to` it has not been shown and uses
      its Site URL instead, so a missing entry sends someone to whatever that
      happens to be — localhost:3000 on a fresh project — with a valid token
      in the fragment and no clue why. Saying so in the console beats letting
      them work it out from a dead address.
    */
    if (import.meta.env.DEV) {
      console.info(
        `[tobot] Signing in with Google. Supabase must list ${target} under ` +
          'Authentication → URL Configuration → Redirect URLs, or it will ' +
          'return to its Site URL instead.',
      );
    }
  };

  const title =
    mode === 'signIn'
      ? d.auth.signInTitle
      : mode === 'signUp'
        ? d.auth.signUpTitle
        : mode === 'forgot'
          ? d.auth.forgotTitle
          : d.auth.newPasswordTitle;

  const body =
    mode === 'signIn'
      ? d.auth.signInBody
      : mode === 'signUp'
        ? d.auth.signUpBody
        : mode === 'forgot'
          ? d.auth.forgotBody
          : d.auth.newPasswordBody;

  const action =
    mode === 'signIn'
      ? d.auth.signIn
      : mode === 'signUp'
        ? d.auth.signUp
        : mode === 'forgot'
          ? d.auth.sendReset
          : d.auth.savePassword;

  /* The two ways in sit side by side, and neither belongs on a page that is
     recovering an account or asking for an address to write to. */
  const choosingHowToEnter = mode === 'signIn' || mode === 'signUp';

  return (
    <div className="signin">
      <div className="signin__panel">
        <div className="signin__brand">
          <BrandMark size={26} className="signin__mark" />
          <span>{d.app.name}</span>
        </div>

        <h1 className="signin__title">{title}</h1>
        <p className="signin__subtitle">{body}</p>

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

          {/* The recovery form has no use for an address: the link already
              said whose account this is. */}
          {mode !== 'newPassword' && (
            <label className="signin__field">
              <span>{d.auth.email}</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={d.auth.emailHint}
              />
            </label>
          )}

          {mode !== 'forgot' && (
            <PasswordField
              label={mode === 'newPassword' ? d.auth.newPassword : d.auth.password}
              hint={d.auth.passwordHint}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            />
          )}

          {/* Asked twice only where a typo would be unrecoverable. Signing in
              is not: a wrong password is refused on the spot and tried again,
              whereas one set blind locks the account behind itself. */}
          {(mode === 'signUp' || mode === 'newPassword') && (
            <PasswordField
              label={d.auth.confirmPassword}
              hint={d.auth.confirmPasswordHint}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
          )}

          {mode === 'signIn' && (
            <button type="button" className="signin__forgot" onClick={() => goTo('forgot')}>
              {d.auth.forgotPassword}
            </button>
          )}

          {error && (
            <p className="signin__error">
              <Warning weight="fill" aria-hidden="true" />
              {error}
            </p>
          )}
          {notice && <p className="signin__notice">{notice}</p>}

          <button type="submit" className="signin__submit" disabled={busy || done}>
            {busy ? d.auth.working : action}
            {!busy && <ArrowRight weight="bold" />}
          </button>
        </form>

        {choosingHowToEnter && isGoogleEnabled && (
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

        {choosingHowToEnter && (
          <p className="signin__switch">
            {mode === 'signIn' ? d.auth.noAccount : d.auth.haveAccount}{' '}
            <button type="button" onClick={() => goTo(mode === 'signIn' ? 'signUp' : 'signIn')}>
              {mode === 'signIn' ? d.auth.signUp : d.auth.signIn}
            </button>
          </p>
        )}

        {mode === 'forgot' && (
          <p className="signin__switch">
            <button type="button" className="signin__back" onClick={() => goTo('signIn')}>
              <ArrowLeft weight="bold" />
              {d.auth.backToSignIn}
            </button>
          </p>
        )}

        {/* Not offered mid-recovery: there is one thing to finish here, and a
            way out that abandons it halfway is an invitation to do so. */}
        {choosingHowToEnter && (
          <button type="button" className="signin__skip" onClick={onSkip}>
            {d.auth.continueWithout}
          </button>
        )}
      </div>
    </div>
  );
});
