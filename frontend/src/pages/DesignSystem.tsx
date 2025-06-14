import React from 'react'
import { AnimatedText, ShimmerText, GradientText } from '@/components/ui/animated-text'
import { AnimatedCard, GlowCard, FlipCard } from '@/components/ui/animated-card'
import { AnimatedButton, MagneticButton, RippleButton } from '@/components/ui/animated-button'
import { Spinner, DotsLoader, PulseLoader, ProgressLoader, SkeletonLoader } from '@/components/ui/animated-loader'
import { GradientBackground, ParticleBackground } from '@/components/ui/animated-background'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const DesignSystem: React.FC = () => {
  const [progress, setProgress] = React.useState(0)
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 0 : prev + 10))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-bold">
            <GradientText text="FossaWork Design System" gradient="from-blue-600 via-purple-600 to-pink-600" />
          </h1>
          <p className="text-xl text-muted-foreground">
            <AnimatedText text="Beautiful, animated UI components inspired by ReactBits" animationType="split" />
          </p>
        </header>

        {/* Text Animations */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Text Animations</h2>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Animated Text Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Reveal Animation</p>
                  <AnimatedText text="This text reveals with a beautiful animation" animationType="reveal" className="text-2xl" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Split Animation</p>
                  <AnimatedText text="Each character appears individually" animationType="split" className="text-2xl" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Bounce Animation</p>
                  <AnimatedText text="Words bounce in one by one" animationType="bounce" className="text-2xl" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Shimmer Text</p>
                  <ShimmerText text="This text has a shimmer effect" className="text-2xl font-bold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Gradient Text</p>
                  <GradientText text="Beautiful gradient text" gradient="from-green-600 to-blue-600" className="text-2xl font-bold" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Card Animations */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Animated Cards</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <AnimatedCard hover="lift" animate="slide" delay={0}>
              <CardHeader>
                <CardTitle>Lift on Hover</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card lifts up when you hover over it with a smooth shadow transition.</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard hover="glow" animate="slide" delay={0.1}>
              <CardHeader>
                <CardTitle>Glow Effect</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card has a beautiful glow effect on hover.</p>
              </CardContent>
            </AnimatedCard>

            <AnimatedCard hover="scale" animate="slide" delay={0.2}>
              <CardHeader>
                <CardTitle>Scale Animation</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card scales up slightly when hovered.</p>
              </CardContent>
            </AnimatedCard>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <GlowCard glowColor="rgba(139, 92, 246, 0.3)">
              <CardHeader>
                <CardTitle>Interactive Glow Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Move your mouse over this card to see the glow follow your cursor!</p>
              </CardContent>
            </GlowCard>

            <div className="h-48">
              <FlipCard
                front={
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-2">Click to Flip</h3>
                      <p className="text-muted-foreground">See what's on the other side!</p>
                    </div>
                  </div>
                }
                back={
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-2">Back Side</h3>
                      <p className="text-muted-foreground">Click again to flip back!</p>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </section>

        {/* Button Animations */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Animated Buttons</h2>
          <Card>
            <CardHeader>
              <CardTitle>Button Variants</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <AnimatedButton animation="pulse">Pulse Animation</AnimatedButton>
              <AnimatedButton animation="shimmer">Shimmer Effect</AnimatedButton>
              <AnimatedButton animation="glow">Glow Effect</AnimatedButton>
              <AnimatedButton animation="bounce">Bounce</AnimatedButton>
              <MagneticButton>Magnetic Button</MagneticButton>
              <RippleButton>Ripple Effect</RippleButton>
            </CardContent>
          </Card>
        </section>

        {/* Loaders */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Loading Animations</h2>
          <Card>
            <CardHeader>
              <CardTitle>Loader Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-around">
                <div className="text-center space-y-2">
                  <Spinner size="sm" />
                  <p className="text-sm text-muted-foreground">Small Spinner</p>
                </div>
                <div className="text-center space-y-2">
                  <Spinner size="md" />
                  <p className="text-sm text-muted-foreground">Medium Spinner</p>
                </div>
                <div className="text-center space-y-2">
                  <Spinner size="lg" />
                  <p className="text-sm text-muted-foreground">Large Spinner</p>
                </div>
              </div>

              <div className="flex items-center justify-around">
                <div className="text-center space-y-2">
                  <DotsLoader />
                  <p className="text-sm text-muted-foreground">Dots Loader</p>
                </div>
                <div className="text-center space-y-2">
                  <PulseLoader />
                  <p className="text-sm text-muted-foreground">Pulse Loader</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Progress Loader</p>
                <ProgressLoader progress={progress} />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Skeleton Loader</p>
                <div className="space-y-2">
                  <SkeletonLoader className="h-4 w-full" />
                  <SkeletonLoader className="h-4 w-3/4" />
                  <SkeletonLoader className="h-4 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Backgrounds */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold">Animated Backgrounds</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GradientBackground className="h-64 rounded-lg border">
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Gradient Background</h3>
                  <p className="text-muted-foreground">Animated gradient effect</p>
                </div>
              </div>
            </GradientBackground>

            <ParticleBackground className="h-64 rounded-lg border bg-card" particleCount={30}>
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Particle Background</h3>
                  <p className="text-muted-foreground">Floating particles animation</p>
                </div>
              </div>
            </ParticleBackground>
          </div>
        </section>
      </div>
    </div>
  )
}

export default DesignSystem