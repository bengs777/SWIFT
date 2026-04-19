export type TemplateVariant = 'short' | 'medium' | 'extended'
export type PromptTemplateKey = 'landing' | 'auth' | 'dashboard'

export const PROMPT_TEMPLATES: Record<PromptTemplateKey, Record<TemplateVariant, string>> = {
  landing: {
    short:
      'Build a responsive marketing landing page with hero, features, testimonials, and a primary CTA. Use Next.js (App Router), Tailwind CSS, and TypeScript. Output components and a page.',
    medium:
      'Create a marketing landing page with a hero section, 3 feature blocks, pricing table, and contact CTA. Include accessible markup, Tailwind classes, and a basic responsive layout. Provide files for components and page.',
    extended:
      'Generate a full marketing landing page starter: hero (headline, subhead, CTA), features (3 items), pricing cards, testimonials, footer with legal links, and meta tags. Use Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui where appropriate. Output multiple files including components and page.',
  },
  auth: {
    short:
      'Create a simple authentication flow with Sign Up and Sign In pages using NextAuth-compatible endpoints. Include form validation and password hashing notes.',
    medium:
      'Generate Sign Up, Sign In, and Password Reset UI with client-side validation and API route templates. Use Next.js App Router and TypeScript.',
    extended:
      'Produce a complete auth starter: Sign Up, Sign In, OAuth buttons, session handling, and secure server routes. Include sample Prisma schema changes and notes for password hashing and email verification.',
  },
  dashboard: {
    short:
      'Create a dashboard layout with sidebar, header, and a data cards area. Use Tailwind and responsive design.',
    medium:
      'Generate dashboard pages with a list view and detail view, cards for KPIs, and a settings area. Use Next.js App Router and TypeScript.',
    extended:
      'Produce a multi-page dashboard starter: overview, projects list, project detail with code preview, and account settings. Include basic API route stubs and Prisma model suggestions.',
  },
}

export function getTemplate(key: PromptTemplateKey, variant: TemplateVariant = 'short') {
  return PROMPT_TEMPLATES[key][variant]
}

export default PROMPT_TEMPLATES
