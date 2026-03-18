import { useState, useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

function safeRedirectPath(raw) {
  if (!raw || typeof raw !== 'string') return '/'
  let path = raw.trim()
  if (path.includes('://')) {
    try {
      const u = new URL(path)
      if (u.origin !== window.location.origin) return '/'
      path = u.pathname + u.search
    } catch {
      return '/'
    }
  }
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('/invite/')) return path
  if (path.startsWith('/w/')) return path
  if (path.startsWith('/workspaces')) return path
  return '/'
}

export function Login() {
  const { theme, toggleTheme } = useTheme()
  const [searchParams] = useSearchParams()
  const next = useMemo(
    () => safeRedirectPath(searchParams.get('next') || ''),
    [searchParams]
  )
  const { user, loading, login, loginGoogle, firebaseReady } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (user) return <Navigate to={next} replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await login(email, password)
    } catch (ex) {
      setErr(ex.message || 'Sign in failed')
    }
  }

  const google = () => {
    setErr('')
    loginGoogle().catch((ex) => setErr(ex.message))
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <Link
        to="/"
        className="absolute left-4 top-4 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Home
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">Disavow Tool</CardTitle>
          <CardDescription>
            Backlink review and Google disavow files. Sign in to open your workspace — there is no
            separate public home page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!firebaseReady && (
            <div
              className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground dark:text-amber-100/90"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium">Configure Firebase (client)</p>
                <p className="mt-1 text-muted-foreground dark:text-amber-100/70">
                  Copy <code className="rounded bg-muted px-1 text-xs">client/.env.example</code> to{' '}
                  <code className="rounded bg-muted px-1 text-xs">.env.local</code> and set{' '}
                  <code className="rounded bg-muted px-1 text-xs">VITE_FIREBASE_*</code>. Restart{' '}
                  <code className="rounded bg-muted px-1 text-xs">npm run dev</code>.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={!firebaseReady}>
              Continue
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
              <span className="bg-card px-2">or</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full border-border"
            onClick={google}
            disabled={!firebaseReady}
          >
            Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
