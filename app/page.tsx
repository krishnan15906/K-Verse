import { SignInForm } from "@/components/sign-in-form"
import { AuthBackground } from "@/components/auth-background"

export default function Page() {
  return (
    <AuthBackground>
      <SignInForm />
    </AuthBackground>
  )
}
