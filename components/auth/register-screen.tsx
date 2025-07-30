"use client"
import { useMemo, useState } from "react"
import type React from "react"
import { supabase } from "@/lib/supabase"

// Removed Link import as it's no longer needed for the "Sign In" button
import { Eye, EyeOff, Mail, Building2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

interface RegisterScreenProps {
  onRegister: () => void
  onSwitchToLogin: () => void
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function RegisterScreen({ onRegister, onSwitchToLogin }: RegisterScreenProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("product")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const isFormComplete = useMemo(() => {
    const allFilled =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      department.trim().length > 0 &&
      password.trim().length > 0 &&
      confirm.trim().length > 0

    const pwOk = password === confirm
    const emailValid = isValidEmail(email)

    return allFilled && pwOk && emailValid && agreed
  }, [firstName, lastName, email, department, password, confirm, agreed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormComplete || isLoading) return

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          department: department,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      console.log("Registration successful:", data)

      // If we have a session, set it in the Supabase client
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
        
        if (sessionError) {
          console.error("Error setting session:", sessionError)
          throw new Error("Failed to establish session")
        }
        
        console.log("Session established successfully")
      }

      // Check if email confirmation is required
      if (data.user && !data.user.emailConfirmed) {
        setSuccess("Registration successful! Please check your email to confirm your account.")
        // Don't call onRegister yet - wait for email confirmation
      } else {
        // User is automatically confirmed, proceed to authenticated state
        onRegister()
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden">
      {/* Background image (no stretch) */}
      <img
        src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/Luckysignup.png"
        alt="Background of people collaborating"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Overlay goes fully white at the bottom; tuned for small screens */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.82)_55%,rgba(255,255,255,0.9)_70%,rgba(255,255,255,1)_85%)]"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4">
        {/* Header */}
        <header className="flex flex-col items-center justify-center pt-6 sm:pt-8">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryvewithus.png"
            alt="thryve with Us"
            className="mx-auto h-auto w-[clamp(170px,50vw,240px)]"
          />
          <h1
            className="mt-4 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 bg-clip-text text-[clamp(24px,7vw,36px)] font-extrabold tracking-tight text-transparent"
            aria-label="Get Started"
          >
            {"Get Started"}
          </h1>
        </header>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 mb-3 grid gap-4 sm:mt-6 sm:gap-5">
          {/* First / Last Name side-by-side (stay on one row) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
                {"First Name"}
              </Label>
              <Input
                id="firstName"
                placeholder="Nicole"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                className="h-[clamp(40px,10.5vw,48px)] rounded-full border-white/60 bg-white/80 text-[clamp(14px,3.8vw,16px)] placeholder:opacity-70 disabled:opacity-50"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
                {"Last Name"}
              </Label>
              <Input
                id="lastName"
                placeholder="Shengli"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                className="h-[clamp(40px,10.5vw,48px)] rounded-full border-white/60 bg-white/80 text-[clamp(14px,3.8vw,16px)] placeholder:opacity-70 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email */}
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
              {"Work Email Address"}
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)] -translate-y-1/2 text-zinc-500" />
              <Input
                id="email"
                type="email"
                placeholder="nicole.shengli@bpi.com.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                aria-invalid={email.length > 0 ? !isValidEmail(email) : false}
                className="h-[clamp(40px,10.5vw,48px)] w-full rounded-full border-white/60 bg-white/80 pl-9 text-[clamp(14px,3.8vw,16px)] placeholder:opacity-70 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Department (full width) */}
          <div className="grid gap-1.5">
            <Label htmlFor="department" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
              {"Department"}
            </Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)] -translate-y-1/2 text-zinc-500" />
              <Select value={department} onValueChange={(v) => setDepartment(v)} disabled={isLoading}>
                <SelectTrigger
                  id="department"
                  className="h-[clamp(44px,11.2vw,52px)] w-full rounded-full border-white/60 bg-white/80 pl-9 pr-8 text-left text-[clamp(14px,3.8vw,16px)] disabled:opacity-50"
                >
                  <SelectValue placeholder="Product Management" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56 z=100">
                  <SelectItem value="product">{"Product Management"}</SelectItem>
                  <SelectItem value="engineering">{"Engineering"}</SelectItem>
                  <SelectItem value="design">{"Design"}</SelectItem>
                  <SelectItem value="marketing">{"Marketing"}</SelectItem>
                  <SelectItem value="sales">{"Sales"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Password */}
          <div className="grid gap-1.5">
            <Label htmlFor="password" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
              {"Password"}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-[clamp(40px,10.5vw,48px)] rounded-full border-white/60 bg-white/80 pr-10 text-[clamp(14px,3.8vw,16px)] placeholder:opacity-70 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 z-30 cursor-pointer disabled:opacity-50"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? (
                  <EyeOff className="h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)]" />
                ) : (
                  <Eye className="h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)]" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword" className="text-[clamp(12px,3.4vw,14px)] text-zinc-800">
              {"Confirm Password"}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPw2 ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isLoading}
                className="h-[clamp(40px,10.5vw,48px)] rounded-full border-white/60 bg-white/80 pr-10 text-[clamp(14px,3.8vw,16px)] placeholder:opacity-70 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPw2((s) => !s)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 z-30 cursor-pointer disabled:opacity-50"
                aria-label={showPw2 ? "Hide confirm password" : "Show confirm password"}
              >
                {showPw2 ? (
                  <EyeOff className="h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)]" />
                ) : (
                  <Eye className="h-[clamp(14px,3.8vw,16px)] w-[clamp(14px,3.8vw,16px)]" />
                )}
              </button>
            </div>
          </div>

          {/* Terms unit */}
          <div className="max-w-[95%] self-start">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-3">
              {/* checkbox column */}
              <div className="self-start">
                <Checkbox
                  id="agree"
                  className="mt-0 border-black shrink-0"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(Boolean(v))}
                  disabled={isLoading}
                />
              </div>

              {/* text column (block so wraps inside column 2 only) */}
              <Label
                htmlFor="agree"
                className="block cursor-pointer select-none text-zinc-700 text-[12px] sm:text-[13px] leading-tight"
              >
                I agree the{" "}
                <a href="#" className="font-semibold text-red-600 underline underline-offset-2">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="#" className="font-semibold text-red-600 underline underline-offset-2">
                  privacy policy
                </a>
              </Label>
            </div>
          </div>

          {/* CTA Button: only highlighted when valid; softer gray by default */}
          <button
            type="submit"
            disabled={!isFormComplete || isLoading}
            className={[
              "my-0 h-[clamp(42px,10.8vw,48px)] w-full rounded-full text-[clamp(14px,4vw,16px)] font-semibold shadow-sm transition-all relative z-20",
              "disabled:cursor-not-allowed",
              isFormComplete && !isLoading
                ? "bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white hover:shadow-lg cursor-pointer"
                : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-300 cursor-not-allowed",
            ].join(" ")}
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {/* Bottom spacing scales with mascot height on mobile */}
        <p className="mb-[clamp(140px,28vw,240px)] text-center text-sm text-zinc-700">
          {"Already have an account? "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            disabled={isLoading}
            className="font-semibold text-sky-600 underline cursor-pointer relative z-20 disabled:opacity-50"
          >
            {"Sign In"}
          </button>
        </p>
      </div>

      {/* Footer illustration — ellipse L➜R and mascot hugs right; both scale with viewport */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <div className="relative">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/Ellipse%20202.svg"
            alt="Decorative curved footer shape"
            className="absolute bottom-0 left-0 w-[130%] max-w-none sm:w-[120%]"
          />
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/winking_mascot.svg"
            alt="Winking mascot"
            className="absolute bottom-0 right-0 z-10 h-[clamp(160px,34vw,240px)] w-auto"
          />
        </div>
      </div>
    </main>
  )
}
