"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface OnboardingScreenProps {
  onComplete: () => void
  onSkip: () => void
}

const onboardingData = [
  {
    id: 1,
    image: "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_1.svg",
    description:
      "Thryve Rapid Prototyping — Deep Market Research, modification on demand, and launches market-ready innovations for a better tomorrow.",
  },
  {
    id: 2,
    image: "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_2.svg",
    description:
      "Discover High-Demand Opportunities. Leverage advanced AI to forecast industry trends. With AI-powered market prototyping we are ready to lead the future.",
  },
  {
    id: 3,
    images: [
      "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_3.svg",
      "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_4.svg",
      "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_5.svg",
      "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_6.svg",
    ],
    description:
      "Yve, our agentic AI, is more than a chatbot — she's your design partner, strategist, and late-night idea machine, available 24/7.",
  },
  {
    id: 4,
    image: "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_7.svg",
    description:
      "Bring your team into the process. Enable cross-functional teams to collaborate, review, and iterate in real time.",
  },
  {
    id: 5,
    image: "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/onboarding_8.svg",
    description: "Thryve enables faster product cycles, smarter decisions, and transformative impact",
    isLastSlide: true,
  },
]

export function OnboardingScreen({ onComplete, onSkip }: OnboardingScreenProps) {
  const [currentScreen, setCurrentScreen] = useState(0)
  const [nextScreen, setNextScreen] = useState<number | null>(null)
  const [isSkipping, setIsSkipping] = useState(false)
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 })
  const skipButtonRef = useRef<HTMLButtonElement>(null)
  const thriveButtonRef = useRef<HTMLButtonElement>(null)
  const autoProgressRef = useRef<NodeJS.Timeout | null>(null)
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    const preloadImages = () => {
      const allImages: string[] = []

      onboardingData.forEach((item) => {
        if (item.image) {
          allImages.push(item.image)
        }
        if (item.images) {
          allImages.push(...item.images)
        }
      })

      allImages.forEach((src) => {
        const img = new Image()
        img.onload = () => {
          setPreloadedImages((prev) => new Set(prev).add(src))
        }
        img.src = src
      })
    }

    preloadImages()
  }, [])

  useEffect(() => {
    // Preload next page images when transitioning
    if (currentScreen < onboardingData.length - 1) {
      const nextPageData = onboardingData[currentScreen + 1]
      if (nextPageData.image && !preloadedImages.has(nextPageData.image)) {
        const img = new Image()
        img.src = nextPageData.image
      }
      if (nextPageData.images) {
        nextPageData.images.forEach((src) => {
          if (!preloadedImages.has(src)) {
            const img = new Image()
            img.src = src
          }
        })
      }
    }
  }, [currentScreen, preloadedImages])

  useEffect(() => {
    if (currentScreen === 2 && onboardingData[2].images) {
      const imageTimer = setInterval(() => {
        setCurrentImageIndex((prev) => {
          const nextIndex = prev + 1
          if (nextIndex >= onboardingData[2].images!.length) {
            return onboardingData[2].images!.length - 1 // Stay at the last image
          }
          return nextIndex
        })
      }, 1000)
      return () => clearInterval(imageTimer)
    }
  }, [currentScreen])

  useEffect(() => {
    if (autoProgressRef.current) {
      clearTimeout(autoProgressRef.current)
    }

    autoProgressRef.current = setTimeout(() => {
      if (currentScreen < onboardingData.length - 1) {
        handleTransition(currentScreen + 1, "left")
      } else {
        handleAutoComplete()
      }
    }, 4000)

    return () => {
      if (autoProgressRef.current) {
        clearTimeout(autoProgressRef.current)
      }
    }
  }, [currentScreen])

  useEffect(() => {
    if (currentScreen === 2) {
      setCurrentImageIndex(0)
    }
  }, [currentScreen])

  const handleTransition = (targetScreen: number, direction: "left" | "right") => {
    if (autoProgressRef.current) {
      clearTimeout(autoProgressRef.current)
    }

    setNextScreen(targetScreen)
    setSlideDirection(direction)

    setTimeout(() => {
      setCurrentScreen(targetScreen)
      setNextScreen(null)
      setSlideDirection(null)
    }, 400)
  }

  const handleAutoComplete = () => {
    if (thriveButtonRef.current) {
      const rect = thriveButtonRef.current.getBoundingClientRect()
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      setClickPosition(position)
    }
    setIsAnimating(true)
    setTimeout(() => {
      onComplete()
    }, 800)
  }

  const handleNext = () => {
    if (currentScreen < onboardingData.length - 1) {
      handleTransition(currentScreen + 1, "left")
    } else {
      handleAutoComplete()
    }
  }

  const handlePrevious = () => {
    if (currentScreen > 0) {
      handleTransition(currentScreen - 1, "right")
    }
  }

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > minSwipeDistance && currentScreen < onboardingData.length - 1) {
      handleNext()
    }
    if (distance < -minSwipeDistance && currentScreen > 0) {
      handlePrevious()
    }
  }

  const handleSkip = (event: React.MouseEvent) => {
    if (skipButtonRef.current) {
      const rect = skipButtonRef.current.getBoundingClientRect()
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      setClickPosition(position)
    }
    setIsAnimating(true)
    setTimeout(() => {
      onSkip()
    }, 800)
  }

  const handleThriveNow = (event: React.MouseEvent) => {
    if (thriveButtonRef.current) {
      const rect = thriveButtonRef.current.getBoundingClientRect()
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      setClickPosition(position)
    }
    setIsAnimating(true)
    setTimeout(() => {
      onComplete()
    }, 800)
  }

  const handleDotClick = (index: number) => {
    if (index !== currentScreen) {
      handleTransition(index, index > currentScreen ? "left" : "right")
    }
  }

  const currentData = onboardingData[currentScreen]
  const nextData = nextScreen !== null ? onboardingData[nextScreen] : null
  const isLastPage = currentScreen === onboardingData.length - 1

  const getCurrentImage = () => (currentData.images ? currentData.images[currentImageIndex] : currentData.image)
  const getNextImage = () => (nextData?.images ? nextData.images[0] : nextData?.image)

  return (
    <div
      className={`fixed inset-0 bg-background z-50 animate-fade-in ${isSkipping ? "animate-swipe-down" : ""}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={skipButtonRef}
        onClick={handleSkip}
        className="absolute top-6 right-6 z-10 px-4 py-2 rounded-full text-white font-medium transition-all duration-200 hover:scale-105 skip-button-gradient"
      >
        Skip
      </button>

      {/* Main Content */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Landing Image */}
        <div className="flex-1 relative overflow-hidden">
          {/* Current Page Image */}
          <div
            className={`absolute inset-0 transition-transform duration-700 ease-out ${
              slideDirection === "left"
                ? "animate-slide-out-left"
                : slideDirection === "right"
                  ? "animate-slide-out-right"
                  : ""
            }`}
          >
            <img
              src={getCurrentImage() || "/placeholder.svg"}
              alt={`Onboarding ${currentData.id}`}
              className={`w-full h-full ${
                currentData.id === 1 || currentData.id === 5
                  ? "object-contain"
                  : currentData.id === 3
                    ? "object-contain scale-x-100 scale-y-90"
                    : "object-contain"
              }`}
            />
          </div>

          {/* Next Page Image - Added incoming page during transition */}
          {nextData && (
            <div
              className={`absolute inset-0 transition-transform duration-700 ease-out ${
                slideDirection === "left"
                  ? "animate-slide-in-right"
                  : slideDirection === "right"
                    ? "animate-slide-in-left"
                    : ""
              }`}
            >
              <img
                src={getNextImage() || "/placeholder.svg"}
                alt={`Onboarding ${nextData.id}`}
                className={`w-full h-full ${
                  nextData.id === 1 || nextData.id === 5
                    ? "object-contain"
                    : nextData.id === 3
                      ? "object-contain scale-x-100 scale-y-90"
                      : "object-contain"
                }`}
              />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="bg-background px-6 py-4 space-y-4 overflow-hidden relative">
          {/* Current Page Content */}
          <div
            className={`text-center transition-all duration-700 ease-out ${
              slideDirection === "left"
                ? "animate-slide-out-left"
                : slideDirection === "right"
                  ? "animate-slide-out-right"
                  : ""
            }`}
          >
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto font-sans font-semibold">
              {currentData.description}
            </p>
          </div>

          {/* Next Page Content - fixed positioning to prevent bottom-to-center movement */}
          {nextData && (
            <div
              className={`text-center transition-all duration-700 ease-out absolute top-0 left-0 right-0 py-4 px-6 ${
                slideDirection === "left"
                  ? "animate-slide-in-right"
                  : slideDirection === "right"
                    ? "animate-slide-in-left"
                    : ""
              }`}
            >
              <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto font-sans font-semibold">
                {nextData.description}
              </p>
            </div>
          )}

          {/* Navigator */}
          <div className="flex items-center justify-between px-2">
            {isLastPage ? (
              <div className="w-full flex justify-center">
                <button
                  ref={thriveButtonRef}
                  onClick={handleThriveNow}
                  className="bg-[#CF0306] text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-[#b8020a] active:scale-95 transition-all duration-200 font-sans"
                >
                  Thryve Now
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handlePrevious}
                  disabled={currentScreen === 0}
                  className={`p-3 rounded-full transition-all duration-200 shadow-md ${
                    currentScreen === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#CF0306] text-white hover:bg-[#b8020a] active:scale-95 hover:shadow-lg"
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {onboardingData.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleDotClick(index)}
                      className={`rounded-full transition-all duration-300 ${
                        index === currentScreen
                          ? "w-6 h-2 bg-[#CF0306] shadow-sm"
                          : "w-2 h-2 bg-gray-400 hover:bg-gray-300 cursor-pointer"
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="p-3 rounded-full bg-[#CF0306] text-white hover:bg-[#b8020a] active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="text-center pt-2">
            <span className="text-xs text-muted-foreground font-sans">
              {currentScreen + 1} of {onboardingData.length}
            </span>
          </div>
        </div>
      </div>

      {isAnimating && (
        <div
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{
            background: "#CF0306",
            clipPath: `circle(0px at ${clickPosition.x}px ${clickPosition.y}px)`,
            animation: "expandCircleFromPosition 0.8s ease-out forwards",
          }}
        />
      )}
    </div>
  )
}
