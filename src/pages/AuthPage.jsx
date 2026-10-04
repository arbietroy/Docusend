import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Badge'

// ─── Password strength ───
function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['', 'Weak', 'Medium', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-green-500']
  const texts  = ['', 'text-red-400', 'text-amber-400', 'text-green-400']
  return (
    <div>
      <div className="flex gap-1 mt-2">
        {[1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-white/10'}`} />
        ))}
      </div>
      {score > 0 && <p className={`text-xs mt-1 ${texts[score]}`}>{labels[score]} password</p>}
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 bg-[#111F3A] border-r border-white/8 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <a href="/" className="text-xl font-black">Docu<span className="text-blue-500">Send</span></a>
      <div>
        <h1 className="text-4xl font-black leading-tight tracking-tight mb-5">
          Documents sent.<br />
          <span className="text-blue-500">Automatically.</span>
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-xs">
          Join businesses across Nigeria who have eliminated manual document sending forever.
        </p>
        <div className="flex flex-col gap-4">
          {[
            ['⚡', 'bold', '3-second delivery', ' — from payment to client inbox'],
            ['📄', 'bold', 'All documents included', ' — contracts, receipts, acknowledgements'],
            ['📊', 'bold', 'Full payment tracking', ' — installments, balances, history'],
            ['🔒', 'bold', 'Your data, your control', ' — connected to your own Gmail & Drive'],
          ].map(([icon, , strong, rest]) => (
            <div key={strong} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-base shrink-0">
                {icon}
              </div>
              <p className="text-sm text-slate-400"><strong className="text-white">{strong}</strong>{rest}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">© 2026 DocuSend</p>
    </div>
  )
}

export default function AuthPage() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const {
    user, loading: authLoading, recovering,
    signUp, signIn, signInWithGoogle, resetPassword, updatePassword, resendVerification,
  } = useAuth()

  // Team invites link here with the invited email filled in
  const inviteEmail = params.get('invite') || ''

  // screens: signup | verify | login | forgot | newPassword
  const [screen, setScreen] = useState('signup')
  const [alert,  setAlert]  = useState({ msg: '', type: 'error' })
  const [loading, setLoading] = useState(false)

  // form state
  const [business, setBusiness] = useState('')
  const [email,    setEmail]    = useState(inviteEmail)
  const [password, setPassword] = useState('')
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [forgotEmail, setForgotEmail]     = useState('')
  const [showResend, setShowResend]       = useState(false)
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // countdown
  const [countdown, setCountdown] = useState(0)

  // Decide which screen to show once we know who (if anyone) is signed in
  useEffect(() => {
    if (authLoading) return
    if (params.get('reset') === 'true' || recovering) { setScreen('newPassword'); return }
    // Signed in: the app takes them to company setup or their dashboard
    if (user) { navigate('/app', { replace: true }); return }
    if (params.get('mode') === 'login') setScreen('login')
  }, [user, authLoading, recovering, params, navigate])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const showAlert = (msg, type = 'error') => setAlert({ msg, type })
  const clearAlert = () => setAlert({ msg: '', type: 'error' })

  // ── Sign Up ──
  const handleSignUp = async () => {
    if (!inviteEmail && !business.trim()) return showAlert('Please enter your business name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert('Please enter a valid email.')
    if (password.length < 8) return showAlert('Password must be at least 8 characters.')
    setLoading(true); clearAlert()
    const { error } = await signUp(email, password, business)
    setLoading(false)
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        showAlert('This email is already registered but not verified. Click "Resend verification" below.')
        setShowResend(true)
      } else {
        showAlert(error.message)
      }
      return
    }
    setScreen('verify')
    setCountdown(60)
  }

  // ── Resend ──
  const handleResend = async () => {
    if (!email) return
    await resendVerification(email)
    setCountdown(60)
  }

  // ── Verified in another tab/device → sign in here to continue ──
  const handleVerifiedContinue = () => {
    setLoginEmail(email)
    setScreen('login')
    showAlert('Once you\'ve clicked the link in your email, sign in here to continue setting up.', 'info')
  }

  // ── Login ──
  // On success the effect above routes to onboarding or the dashboard
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return showAlert('Please enter your email and password.', 'error')
    setLoading(true); clearAlert()
    const { error } = await signIn(loginEmail, loginPassword)
    setLoading(false)
    if (error) {
      showAlert(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message)
    }
  }

  // ── Forgot ──
  const handleForgot = async () => {
    if (!forgotEmail) return showAlert('Please enter your email.')
    setLoading(true); clearAlert()
    const { error } = await resetPassword(forgotEmail)
    setLoading(false)
    if (error) { showAlert(error.message); return }
    showAlert(`Reset link sent to ${forgotEmail}! Check your inbox.`, 'success')
  }

  // ── Set new password (from reset link) ──
  const handleNewPassword = async () => {
    if (newPassword.length < 8) return showAlert('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return showAlert('Passwords do not match.')
    setLoading(true); clearAlert()
    const { error } = await updatePassword(newPassword)
    setLoading(false)
    if (error) { showAlert(error.message); return }
    navigate('/app', { replace: true })
  }

  const requestNewResetLink = () => {
    clearAlert()
    navigate('/auth', { replace: true })
    setScreen('forgot')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <BrandPanel />

      <div className="flex flex-col justify-center items-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <a href="/" className="block lg:hidden text-xl font-black mb-8">
            Docu<span className="text-blue-500">Send</span>
          </a>

          {/* ── SIGN UP ── */}
          {screen === 'signup' && (
            <div>
              <h2 className="text-2xl font-black mb-1">{inviteEmail ? 'Join your team' : 'Create your account'}</h2>
              <p className="text-sm text-slate-400 mb-7">
                Already have an account?{' '}
                <button onClick={() => { setScreen('login'); clearAlert() }} className="text-blue-400 font-medium hover:underline">Sign in</button>
              </p>
              {alert.msg && <Alert variant={alert.type}>{alert.msg}</Alert>}
              {alert.msg && <div className="mb-4" />}

              {/* Google */}
              <button
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/9 text-sm font-medium transition-colors mb-5"
              >
                <span className="text-base">G</span> Continue with Google
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-xs text-slate-500">or sign up with email</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <div className="flex flex-col gap-3 mb-5">
                 {!inviteEmail && <Input label="Business Name" placeholder="e.g. Apex Properties Ltd" value={business} onChange={e => setBusiness(e.target.value)} />}
                <Input label="Work Email" type="email" placeholder="you@business.com" value={email} onChange={e => setEmail(e.target.value)} />
                <div>
                  <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
                  <PasswordStrength password={password} />
                </div>
              </div>

              <Button className="w-full" loading={loading} onClick={handleSignUp}>Create account</Button>

              {showResend && (
                <button onClick={handleResend} className="w-full mt-3 py-2.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:text-white hover:border-white/30 transition-colors">
                  Resend verification email
                </button>
              )}
              <p className="text-xs text-slate-500 text-center mt-5">
                By signing up you agree to our{' '}
                <a href="#" className="text-blue-400">Terms</a> and{' '}
                <a href="#" className="text-blue-400">Privacy Policy</a>
              </p>
            </div>
          )}

          {/* ── VERIFY ── */}
          {screen === 'verify' && (
            <div>
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-3xl mb-5">📬</div>
              <h2 className="text-2xl font-black mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-400 mb-7">
                We sent a verification link to <strong className="text-white">{email}</strong>
              </p>
              <div className="flex flex-col gap-2.5 mb-7">
                {['Open your email app or inbox', 'Find the email from DocuSend', 'Click the verification link inside'].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/3 border border-white/8 text-sm text-slate-400">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div>
                    {s}
                  </div>
                ))}
              </div>
              <Button className="w-full mb-3" onClick={handleVerifiedContinue}>
                ✓ I've verified my email — continue
              </Button>
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                className="w-full py-2.5 rounded-lg border border-white/10 text-sm text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend verification email'}
              </button>
              <p className="text-xs text-slate-500 text-center mt-4">
                Wrong email?{' '}
                <button onClick={() => setScreen('signup')} className="text-blue-400 hover:underline">Go back</button>
              </p>
            </div>
          )}

          {/* ── LOGIN ── */}
          {screen === 'login' && (
            <div>
              <h2 className="text-2xl font-black mb-1">Welcome back</h2>
              <p className="text-sm text-slate-400 mb-7">
                Don't have an account?{' '}
                <button onClick={() => { setScreen('signup'); clearAlert() }} className="text-blue-400 font-medium hover:underline">Sign up free</button>
              </p>
              {alert.msg && <><Alert variant={alert.type}>{alert.msg}</Alert><div className="mb-4" /></>}
              <button
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/9 text-sm font-medium transition-colors mb-5"
              >
                <span>G</span> Continue with Google
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/8" /><span className="text-xs text-slate-500">or sign in with email</span><div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="flex flex-col gap-3 mb-5">
                <Input label="Email" type="email" placeholder="you@business.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">Password</span>
                    <button onClick={() => { setScreen('forgot'); clearAlert() }} className="text-xs text-blue-400 hover:underline">Forgot password?</button>
                  </div>
                  <Input type="password" placeholder="Your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                </div>
              </div>
              <Button className="w-full" loading={loading} onClick={handleLogin}>Sign in</Button>
            </div>
          )}

          {/* ── FORGOT ── */}
          {screen === 'forgot' && (
            <div>
              <h2 className="text-2xl font-black mb-1">Reset your password</h2>
              <p className="text-sm text-slate-400 mb-7">
                Enter your email and we'll send you a reset link.{' '}
                <button onClick={() => { setScreen('login'); clearAlert() }} className="text-blue-400 hover:underline">← Back to sign in</button>
              </p>
              {alert.msg && <><Alert variant={alert.type}>{alert.msg}</Alert><div className="mb-4" /></>}
              <Input label="Email" type="email" placeholder="you@business.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
              <div className="mt-5">
                <Button className="w-full" loading={loading} onClick={handleForgot}>Send reset link</Button>
              </div>
            </div>
          )}

          {/* ── NEW PASSWORD (from reset link) ── */}
          {screen === 'newPassword' && (
            <div>
              <h2 className="text-2xl font-black mb-1">Choose a new password</h2>
              {authLoading ? (
                <p className="text-sm text-slate-400">Checking your reset link...</p>
              ) : !user ? (
                <div>
                  <p className="text-sm text-slate-400 mb-6">This reset link is invalid or has expired.</p>
                  <Button className="w-full" onClick={requestNewResetLink}>Request a new link</Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-7">
                    Setting a new password for <strong className="text-white">{user.email}</strong>
                  </p>
                  {alert.msg && <><Alert variant={alert.type}>{alert.msg}</Alert><div className="mb-4" /></>}
                  <div className="flex flex-col gap-3 mb-5">
                    <div>
                      <Input label="New Password" type="password" placeholder="At least 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <PasswordStrength password={newPassword} />
                    </div>
                    <Input label="Confirm New Password" type="password" placeholder="Repeat your new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                  <Button className="w-full" loading={loading} onClick={handleNewPassword}>Update password</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
