import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Brain,
  FileOutput,
  Layers,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react'

export function Landing() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans text-slate-900 antialiased selection:bg-teal-200/60 selection:text-slate-900">
      {/* Soft ambient layers — teal / cyan, no purple */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[10%] h-[28rem] w-[28rem] rounded-full bg-teal-400/[0.12] blur-[100px]" />
        <div className="absolute top-[35%] -left-32 h-[22rem] w-[22rem] rounded-full bg-cyan-400/[0.1] blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-64 w-96 rounded-full bg-emerald-300/[0.08] blur-[80px]" />
      </div>
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `linear-gradient(to right, rgb(226 232 240 / 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(226 232 240 / 0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Layers className="h-4 w-4" />
            </span>
            Disavow Tool
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              className="bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              asChild
            >
              <Link to="/login">
                Open app
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 overflow-x-hidden">
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            Built for SEO teams who outgrew spreadsheets
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            From SEMrush export to a{' '}
            <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Google-ready disavow file
            </span>
            — with judgment, not guesswork.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
            Upload backlink CSVs, let the system cluster and score sources, then decide what belongs in
            your disavow. Shared workspace rules remember what you trust — so every site you manage
            gets smarter.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button
              size="lg"
              className="h-12 rounded-xl bg-slate-900 px-8 text-base font-medium text-white hover:bg-slate-800"
              asChild
            >
              <Link to="/login">
                Start free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="flex w-full items-center text-sm text-slate-500 sm:w-auto sm:pl-2">
              No credit card. Firebase sign-in.
            </p>
          </div>
        </section>

        <section className="border-y border-slate-200/80 bg-white/50 py-16 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-6">
            <p className="mb-10 text-center text-sm font-medium uppercase tracking-widest text-slate-500">
              How it works
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Ingest',
                  body: 'Drop your SEMrush backlink export. We normalize domains, dates, and link signals at scale.'
                },
                {
                  step: '02',
                  title: 'Understand',
                  body: 'Automatic grouping and risk signals surface what deserves a look — you stay in control.'
                },
                {
                  step: '03',
                  title: 'Export',
                  body: 'Whitelist, blacklist, and workspace rules compile into a valid disavow.txt you can ship to Search Console.'
                }
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="text-xs font-mono font-medium text-teal-600">{item.step}</span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-teal-700">
                <Brain className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">Intelligence layer</span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Recommendations, not robots
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Heuristic scoring flags sitewide patterns, thin authority, syndication footprints, and
                repetitive anchors — tuned so you can review a queue instead of drowning in rows. Nothing
                hits your disavow file until you say so.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Domain-level and URL-level decisions with notes',
                  'Workspace-wide spam memory across every property you run',
                  'Regenerate exports as rules evolve — history stays audit-friendly'
                ].map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-slate-700">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <Users className="h-8 w-8 text-slate-800" />
                <p className="mt-4 font-semibold text-slate-900">Team workspaces</p>
                <p className="mt-1 text-sm text-slate-600">
                  Invite colleagues, share classifications, keep one source of truth.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <FileOutput className="h-8 w-8 text-slate-800" />
                <p className="mt-4 font-semibold text-slate-900">Disavow you can defend</p>
                <p className="mt-1 text-sm text-slate-600">
                  Preview, comment headers, download — same format Google expects.
                </p>
              </div>
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
                <p className="font-mono text-xs text-slate-500">Sample output</p>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-4 text-left text-xs leading-relaxed text-slate-100">
                  {`# Generated for yourbrand.com
# Workspace: Acme SEO
# Created on 2026-03-17

domain:low-quality-network.example
https://spam.example/bad-page`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200/80 bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Ready to clean up your link graph?
            </h2>
            <p className="mt-4 text-slate-400">
              Sign in, create a workspace, upload a CSV — first disavow draft in minutes.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 rounded-xl bg-white px-8 text-base font-medium text-slate-900 hover:bg-slate-100"
              asChild
            >
              <Link to="/login">
                Go to app
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-white py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
            <span>Disavow Tool — backlink review for serious SEO</span>
            <Link to="/login" className="font-medium text-teal-700 hover:text-teal-800">
              Sign in →
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
