import { Zap, Code2, Eye, Rocket, Sparkles, Shield } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    description: "Describe your vision in natural language. Our AI understands context and generates production-ready code.",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description: "See your changes in real-time. Our sandboxed preview environment lets you interact with your app instantly.",
  },
  {
    icon: Code2,
    title: "Clean Code Output",
    description: "Export clean, maintainable React components with TypeScript, Tailwind CSS, and shadcn/ui.",
  },
  {
    icon: Zap,
    title: "Instant Iteration",
    description: "Refine and iterate quickly. Ask for changes in plain English and watch your app evolve.",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description: "Deploy to production with a single click. We handle hosting, CDN, and SSL automatically.",
  },
  {
    icon: Shield,
    title: "Enterprise Ready",
    description: "SOC2 compliant, SSO support, and team collaboration features for organizations of any size.",
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to ship faster
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            From idea to production in minutes, not months. Swift gives you the tools to build and deploy with confidence.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-border bg-card p-6 transition-colors hover:border-muted-foreground/30"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <feature.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
