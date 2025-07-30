"use client"

import type React from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { useState } from "react"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

interface LoginScreenProps {
  onLogin: () => void
  onSwitchToRegister: () => void
  onForgotPassword: () => void
}

export default function LoginScreen({ onLogin, onSwitchToRegister, onForgotPassword }: LoginScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v)
  const isFormComplete = isValidEmail(email) && password.trim().length > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isFormComplete || isLoading) return

    setIsLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!data.user || !data.session) {
        throw new Error("Login failed - invalid response")
      }

      console.log("Login successful:", data.user.email)

      onLogin()
    } catch (err) {
      console.error("Login error:", err)
      setError(err instanceof Error ? err.message : "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-white text-gray-900">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {/* Parent is relative to allow next/image fill usage [^1][^2] */}
        <div className="relative h-[48vh] sm:h-[52vh]">
          <Image
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/Lucky.png"
            alt="Background"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "top center" }}
          />
          {/* Screen overlay: transparent at top, fades to white at bottom */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 to-white" />
        </div>
      </div>

      {/* Centered logo within hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[48vh] items-center justify-center sm:h-[52vh] -translate-y-[10%]">
        <div className="relative h-15 w-43 sm:h-18 sm:w-46">
          <Image
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_splash.svg"
            alt="Thryve"
            fill
            sizes="(max-width: 840px) 312px, 328px"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Content container */}
      <section className="relative z-30 mx-auto flex w-full max-w-[460px] flex-col px-4 pb-38 sm:px-6 sm:pb-64">
        {/* Spacer */}
        <div className="h-[25vh] sm:h-[28vh]" />

        {/* Login panel - simplified to ensure clickability */}
        <div className="relative rounded-3xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/30">
          <div className="relative px-4 pb-5 pt-1 sm:px-6 sm:pt-6 sm:pb-6 z-10">
            {/* Heading */}
            <h1 className="mb-3 text-center text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 bg-clip-text text-transparent">
                Welcome
              </span>
            </h1>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="contents">
              {/* Email */}
              <div className="mb-4">
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#C63838]">
                  Work Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="nicole.shengli@bpi.com.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-black/10 bg-white/90 pl-10 pr-3 text-[15px] placeholder:text-gray-400 shadow-sm outline-none ring-1 ring-black/5 focus:border-red-400 focus:ring-red-300 relative z-10 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-2">
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#C63838]">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-black/10 bg-white/90 pl-10 pr-12 text-[15px] placeholder:text-gray-400 shadow-sm outline-none ring-1 ring-black/5 focus:border-red-400 focus:ring-red-300 relative z-10 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700 z-20 disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={isLoading}
                    className="text-xs font-semibold text-[#C74D4D] hover:underline relative z-10 disabled:opacity-50"
                  >
                    {"Forgot Password?"}
                  </button>
                </div>
              </div>

              {/* CTA Button: only highlighted when fully complete; improved disabled style */}
              <button
                type="submit"
                disabled={!isFormComplete || isLoading}
                className={[
                  "mt-4 h-12 w-full rounded-full text-base font-semibold shadow-md transition-all disabled:cursor-not-allowed relative z-20",
                  isFormComplete && !isLoading
                    ? "bg-gradient-to-r from-[#E43D3D] via-[#D42C2C] to-[#F0662B] text-white hover:shadow-lg"
                    : "bg-zinc-200 text-zinc-600 cursor-not-allowed",
                ].join(" ")}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {/* Create account */}
            <p className="mt-4 text-center text-sm text-gray-600">
              {"Don't have an account? "}
              <button
                type="button"
                onClick={onSwitchToRegister}
                disabled={isLoading}
                className="font-semibold text-[#1AA8B0] hover:underline relative z-20 cursor-pointer disabled:opacity-50"
              >
                Create Account
              </button>
            </p>

            {/* Terms note */}
            <p className="mt-5 mb-2 px-1 text-center text-xs leading-5 text-gray-600">
              By creating an account or signing you agree to our{" "}
              <a href="#" className="font-semibold text-[#C63838] hover:underline">
                Terms &amp; Conditions
              </a>{" "}
              and{" "}
              <a href="#" className="font-semibold text-gray-800 hover:underline">
                privacy policy
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Bottom illustration (ellipse + mascot) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <div className="relative">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/Ellipse%20202.svg"
            alt="Decorative curved footer shape"
            className="absolute bottom-0 left-0 w-[120%] max-w-none"
          />
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/smiling_mascot.svg"
            alt="Winking mascot"
            className="absolute bottom-0 right-0 z-10 h-[210px] w-auto sm:h-[230px]"
          />
        </div>
      </div>
    </main>
  )
}
