"use client"

import { useState } from "react"
import { Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void
}

export function ForgotPasswordScreen({ onBackToLogin }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)

  const handleResetPassword = async () => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      setIsEmailSent(true)
    }, 1500)
  }

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#7A1216] to-red-800 flex flex-col justify-center p-6">
        <div className="max-w-md mx-auto w-full space-y-8">
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Check Your Email</h2>
                <p className="text-gray-600">
                  We've sent password reset instructions to <span className="font-medium text-gray-900">{email}</span>
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  Didn't receive the email? Check your spam folder or contact IT support.
                </p>
              </div>

              <Button onClick={onBackToLogin} className="w-full h-12 bg-[#7A1216] hover:bg-red-800 text-white">
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#7A1216] to-red-800 flex flex-col justify-center p-6">
      <div className="max-w-md mx-auto w-full space-y-8">
        {/* Header */}
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-[#7A1216] font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
          <p className="text-red-100">Enter your email to receive reset instructions</p>
        </div>

        {/* Reset Form */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center text-gray-900">Forgot Password?</CardTitle>
            <p className="text-center text-gray-600 text-sm">No worries, we'll send you reset instructions</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@bpi.com.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* Reset Button */}
            <Button
              onClick={handleResetPassword}
              disabled={!email || isLoading}
              className="w-full h-12 bg-[#7A1216] hover:bg-red-800 text-white font-medium"
            >
              {isLoading ? "Sending..." : "Send Reset Instructions"}
            </Button>

            {/* Back to Login */}
            <Button onClick={onBackToLogin} variant="ghost" className="w-full h-12 text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-red-100 text-sm">
          <p>Need help? Contact IT Support</p>
          <p className="text-xs opacity-75 mt-1">support@bpi.com.ph</p>
        </div>
      </div>
    </div>
  )
}
