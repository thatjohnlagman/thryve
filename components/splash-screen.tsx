"use client"

import { useState, useEffect } from "react"

interface SplashScreenProps {
  onComplete: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [animationPhase, setAnimationPhase] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)

    const timers: NodeJS.Timeout[] = []

    // Phase 1: Mascot moves from bottom right to center (1s delay, 1.5s animation)
    timers.push(setTimeout(() => setAnimationPhase(1), 1000))

    // Phase 2: Change to second mascot in same position (3s total)
    timers.push(setTimeout(() => setAnimationPhase(2), 3000))

    // Phase 3: Show Thryve logo and move mascot to letter "e" (4.5s total)
    timers.push(setTimeout(() => setAnimationPhase(3), 4500))

    // Phase 4: Show red ellipse shape (6s total) - waits for click
    timers.push(setTimeout(() => setAnimationPhase(4), 6000))

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("resize", checkScreenSize)
    }
  }, [])

  const handleScreenClick = () => {
    if (animationPhase === 4) {
      setAnimationPhase(5)
      setTimeout(() => onComplete(), 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden" onClick={handleScreenClick}>
      <div
        className={`absolute transition-all duration-1500 ease-out`}
        style={{
          width: "230px",
          height: "220px",
          transform:
            animationPhase === 0
              ? "translate(calc(100vw - 180px), calc(100vh - 180px)) rotate(-16deg)"
              : "translate(calc(50vw - 115px), calc(50vh - 110px)) rotate(0deg)",
          opacity: animationPhase < 2 ? 1 : 0,
          transition: "all 1.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out",
        }}
      >
        <img
          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_splash_smile_1 (1).svg"
          alt="Mascot"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Second mascot - appears at center, then moves to letter "e" */}
      <div
        className={`absolute transition-all duration-1000 ease-out`}
        style={{
          width: "230px",
          height: "220px",
          left: animationPhase >= 3 ? `calc(50vw + ${isMobile ? "20px" : "85px"})` : "calc(50vw - 115px)",
          top: animationPhase >= 3 ? "calc(50vh - 90px)" : "calc(50vh - 110px)",
          transform: animationPhase >= 3 ? "scale(0.2)" : "scale(1)",
          opacity: animationPhase >= 2 && animationPhase < 5 ? 1 : 0,
          transition:
            "left 1s cubic-bezier(0.4, 0, 0.2, 1), top 1s cubic-bezier(0.4, 0, 0.2, 1), transform 1s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <img
          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_splash_teeth_smile_1 (1).svg"
          alt="Mascot Center"
          className="w-full h-full object-contain"
        />
      </div>

      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out ${
          animationPhase >= 3 && animationPhase < 5 ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_splash.svg"
          alt="Thryve Logo"
          style={{ width: "325px", height: "133px" }}
          className="object-contain"
        />
      </div>

      <div
              className="absolute bg-red-600 transition-all duration-2000 ease-out"
              style={{
                left: "-50vw",
                right: "-50vw",
                width: "200vw",
                height: animationPhase >= 5 ? "200vh" : "60vh",
                borderRadius: "50%",
                bottom: "-50vh",
                display: animationPhase >= 4 ? "block" : "none",
                transition: animationPhase >= 5 ? "height 2s cubic-bezier(0.4, 0, 0.2, 1)" : "all 0.5s ease-out",
              }}
            />
      </div>
  )
}
