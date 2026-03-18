import { Outlet, Link, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Globe, Shield, Users, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { workspaceId } = useParams()
  const location = useLocation()
  const { profile, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [workspaces, setWorkspaces] = useState([])
  const [domains, setDomains] = useState([])
  const [sharedRulesCount, setSharedRulesCount] = useState(0)

  const refreshWorkspaces = () => {
    api.get('/workspaces').then((r) => setWorkspaces(r.data.workspaces || [])).catch(() => {})
  }

  useEffect(() => {
    refreshWorkspaces()
  }, [workspaceId])

  useEffect(() => {
    const onWs = () => refreshWorkspaces()
    window.addEventListener('workspace-updated', onWs)
    return () => window.removeEventListener('workspace-updated', onWs)
  }, [])

  useEffect(() => {
    if (!workspaceId) {
      setDomains([])
      setSharedRulesCount(0)
      return
    }
    api
      .get(`/workspaces/${workspaceId}/managed-domains`)
      .then((r) => setDomains(r.data.domains || []))
      .catch(() => setDomains([]))
    api
      .get(`/workspaces/${workspaceId}/classifications?scope=workspace`)
      .then((r) => setSharedRulesCount((r.data.rules || []).length))
      .catch(() => setSharedRulesCount(0))
  }, [workspaceId])

  const teamPath = workspaceId ? `/w/${workspaceId}/team` : ''
  const isTeamActive = teamPath && location.pathname === teamPath

  const SidebarInner = ({ sheet }) => (
    <div className={cn('flex h-full flex-col gap-1 p-4', sheet && 'pt-14')}>
      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      {workspaces.map((w) => (
        <Link
          key={w._id}
          to={`/w/${w._id}`}
          className={cn(
            'rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
            workspaceId === w._id && 'bg-accent text-foreground'
          )}
        >
          {w.name}
        </Link>
      ))}
      <Button variant="ghost" size="sm" className="mt-2 justify-start text-muted-foreground" asChild>
        <Link to="/workspaces/new">+ New workspace</Link>
      </Button>
      <Separator className="my-4" />
      {workspaceId && (
        <>
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Domains
          </p>
          {domains.map((d) => (
            <Link
              key={d._id}
              to={`/w/${workspaceId}/domains/${d._id}`}
              className="rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-accent hover:text-foreground"
            >
              {d.displayName || d.domainName}
            </Link>
          ))}
          <Button variant="ghost" size="sm" className="mt-1 justify-start" asChild>
            <Link to={`/w/${workspaceId}/domains`}>
              <Globe className="mr-2 h-4 w-4" />
              All domains
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-auto w-full justify-start px-3 py-2 font-normal" asChild>
            <Link
              to={`/w/${workspaceId}/rules`}
              className="flex w-full items-center gap-2"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 text-left">View rules</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {sharedRulesCount}
              </span>
            </Link>
          </Button>
          <Separator className="my-3" />
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Team
          </p>
          <Link
            to={teamPath}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
              isTeamActive && 'bg-accent text-foreground'
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            Team
          </Link>
        </>
      )}
    </div>
  )

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Disavow
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SidebarInner />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:ml-60">
        <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="border-b border-border p-4 pt-12 text-sm font-semibold">Disavow</div>
              <SidebarInner sheet />
            </SheetContent>
          </Sheet>
          {workspaceId && (
            <nav className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/w/${workspaceId}`}>
                  <LayoutDashboard className="mr-1.5 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-border">
                  {profile?.email?.slice(0, 20) || 'Account'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6 md:p-8">
          <Outlet context={{ workspaces, domains, refreshDomains: () => workspaceId && api.get(`/workspaces/${workspaceId}/managed-domains`).then((r) => setDomains(r.data.domains || [])) }} />
        </main>
      </div>
    </div>
  )
}
