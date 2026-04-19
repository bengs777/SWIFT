import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const errorMessages: { [key: string]: string } = {
  AccessDenied: "Access was denied. You may not have the required permissions.",
  Configuration:
    "There is a problem with the server configuration. Please contact support.",
  Verification:
    "The token has expired or has already been used. Please try signing in again.",
  Default: "An unknown error occurred. Please try again later.",
}

type AuthErrorPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const { error } = await searchParams
  const message =
    error && errorMessages[error] ? errorMessages[error] : errorMessages.Default

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Authentication Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-gray-600 dark:text-gray-400">{message}</p>
          <Button asChild className="w-full">
            <Link href="/login">Go back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
