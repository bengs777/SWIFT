const stats = [
  { value: "20 days", label: "saved on daily builds", company: "Netflix" },
  { value: "98%", label: "faster time to market", company: "Tripadvisor" },
  { value: "300%", label: "increase in SEO", company: "Box" },
  { value: "6x", label: "faster to build + deploy", company: "eBay" },
]

const testimonials = [
  {
    quote: "Swift has completely transformed how our team prototypes. What used to take days now takes minutes.",
    author: "Sarah Chen",
    role: "Engineering Lead",
    company: "TechCorp",
  },
  {
    quote: "The AI understands exactly what I want. It's like having a senior developer who reads my mind.",
    author: "Michael Torres",
    role: "Product Designer",
    company: "DesignCo",
  },
  {
    quote: "We shipped our entire marketing site in a weekend. The code quality is production-ready out of the box.",
    author: "Emily Watson",
    role: "CTO",
    company: "StartupXYZ",
  },
]

export function Testimonials() {
  return (
    <section className="border-t border-border py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Stats */}
        <div className="mb-20 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.company} className="border-l border-border pl-6">
              <div className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              <div className="mt-3 text-sm font-medium text-muted-foreground">{stat.company}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by builders everywhere
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            See what developers and teams are saying about building with Swift.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="rounded-xl border border-border bg-card p-6"
            >
              <p className="text-sm text-foreground">{`"${testimonial.quote}"`}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">
                  {testimonial.author[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{testimonial.author}</div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
