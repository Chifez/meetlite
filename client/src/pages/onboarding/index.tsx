"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Users, Video, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

const onboardingSteps = [
  {
    id: 1,
    title: "Welcome to meetlite",
    description: "Let's get you set up for seamless video collaboration",
    icon: CheckCircle,
    content: {
      heading: "Ready to transform your meetings?",
      subheading: "meetlite makes video collaboration simple, secure, and productive for teams of all sizes.",
      features: [
        "HD video calls with up to 100 participants",
        "Screen sharing and collaborative tools",
        "Meeting recordings and transcripts",
        "Calendar integrations and scheduling",
      ],
    },
  },
  {
    id: 2,
    title: "Choose your workspace",
    description: "Decide how you want to use meetlite",
    icon: Users,
    content: {
      heading: "How will you be using meetlite?",
      subheading: "Choose the option that best describes your needs. You can always change this later.",
      options: [
        {
          id: "personal",
          title: "Personal Use",
          description: "For individual meetings and personal video calls",
          icon: Video,
        },
        {
          id: "team",
          title: "Team/Organization",
          description: "For team collaboration and organizational meetings",
          icon: Users,
        },
      ],
    },
  },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedOption, setSelectedOption] = useState<string>("")
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      // Redirect to login if no user data
      router.push("/login")
    }
  }, [router])

  const handleNext = () => {
    if (currentStep < onboardingSteps.length) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    if (selectedOption === "team") {
      // Redirect to organization setup
      router.push("/onboarding/organization")
    } else {
      // Set up personal account and go to dashboard
      const updatedUser = { ...user, accountType: "personal", onboardingComplete: true }
      localStorage.setItem("user", JSON.stringify(updatedUser))
      router.push("/dashboard")
    }
  }

  const currentStepData = onboardingSteps.find((step) => step.id === currentStep)
  const progress = (currentStep / onboardingSteps.length) * 100

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">ML</span>
            </div>
            <span className="text-xl font-semibold text-foreground">meetlite</span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {onboardingSteps.length}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Content */}
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {currentStepData && (
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <currentStepData.icon className="w-6 h-6 text-primary" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-semibold">{currentStepData?.content.heading}</CardTitle>
            <CardDescription className="text-base">{currentStepData?.content.subheading}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <p className="text-muted-foreground">
                    Hello <span className="font-semibold text-foreground">{user.name}</span>! Welcome to your new video
                    collaboration platform.
                  </p>
                </div>

                <div className="grid gap-3">
                  {currentStepData?.content.features?.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4">
                  {currentStepData?.content.options?.map((option) => (
                    <div
                      key={option.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedOption === option.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedOption(option.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <option.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">{option.title}</h3>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                        </div>
                        {selectedOption === option.id && <CheckCircle className="w-5 h-5 text-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={currentStep === 2 && !selectedOption}
                className="bg-primary hover:bg-primary/90"
              >
                {currentStep === onboardingSteps.length ? "Get Started" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
