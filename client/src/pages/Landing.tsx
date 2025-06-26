import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import {
  CalendarDays,
  Mail,
  Users,
  Zap,
  Globe,
  Shield,
  Monitor,
  Calendar,
  Lock,
  Video,
  Check,
  ArrowRight,
  Star,
  Play,
} from 'lucide-react';

const features = [
  {
    icon: <CalendarDays className="h-8 w-8 text-primary" />,
    title: 'Smart Scheduling',
    description:
      'Powerful scheduling tools that make it easy for everyone. Integrates with your calendar, and automatically reminds via email.',
  },
  {
    icon: <Mail className="h-8 w-8 text-primary" />,
    title: 'Intelligent Invites',
    description:
      'Automatic reminders, join links, and agenda sharing keep everyone prepared.',
  },
  {
    icon: <Lock className="h-8 w-8 text-primary" />,
    title: 'Privacy First',
    description:
      'End-to-end encryption, waiting rooms, and granular permissions. Meetings stay private with enterprise-grade security.',
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: 'Lightning Fast',
    description: 'Join meetings in under 2 seconds.',
  },
  {
    icon: <Globe className="h-8 w-8 text-primary" />,
    title: 'Global CDN',
    description: 'Crystal clear quality worldwide.',
  },
  {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: 'Secure by Design',
    description: 'Zero-knowledge architecture.',
  },
  {
    icon: <Monitor className="h-8 w-8 text-primary" />,
    title: 'HD Quality',
    description: '4K video with super-clear audio.',
  },
];

const pricing = [
  {
    name: 'Starter',
    price: 'Free',
    features: [
      'Up to 3 meetings',
      'Basic scheduling',
      'Email invites',
      'Privacy controls',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    features: [
      'Unlimited meetings',
      'Link-based invites',
      'Advanced scheduling',
      'Priority support',
      'Recording & transcripts',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited participants',
      'Custom branding',
      'Advanced analytics',
      '24/7 support',
      'SSO integration',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];

const stats = [
  { label: '4.8/5 rating' },
  { label: '100,000+ happy users' },
  { label: '99.9% uptime' },
];

const Landing = () => {
  const emailRef = useRef<HTMLInputElement>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailRef.current?.value;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    toast.success('Thank you! We will be in touch.');
    if (emailRef.current) emailRef.current.value = '';
  };

  return (
    <>
      <SEO
        title="MeetLite - Meet Better, Meet Lighter"
        description="Experience seamless video conferencing with advanced scheduling, smart invites, and enterprise-grade privacy."
      />
      <main className="bg-page min-h-screen flex flex-col">
        {/* Hero Section */}
        <section className="pt-20 lg:pt-24 pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <Badge className="mb-6 bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 text-sm px-3 py-1">
                🚀 The future of video meetings is here
              </Badge>
              <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 dark:from-purple-400 dark:via-indigo-400 dark:to-purple-600 bg-clip-text text-transparent leading-[1.1] tracking-tight">
                Meet Better,
                <br />
                Meet Lighter
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
                Experience seamless video conferencing with advanced scheduling,
                smart invites, and enterprise-grade privacy. The Google Meet
                alternative that actually works better.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                <a href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-base px-8 py-6 font-medium shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                  >
                    Start Meeting Now
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </a>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950 text-base px-8 py-6 font-medium transition-all duration-300"
                >
                  <Play className="mr-2 w-4 h-4" />
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center justify-center space-x-4 lg:space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 mr-1" />
                  <span>4.9/5 rating</span>
                </div>
                <div>10,000+ happy users</div>
                <div>99.9% uptime</div>
              </div>
            </div>
          </div>
        </section>
        {/* Features Section */}
        <section id="features" className="py-5 lg:py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Everything you need for perfect meetings
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to make your video meetings more
                productive, secure, and enjoyable than ever before.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <Card className="border border-purple-100 hover:border-purple-200 dark:border-purple-800 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-lg group bg-card">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-xl font-medium text-foreground mb-2">
                    Smart Scheduling
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    AI-powered scheduling that finds the perfect time for
                    everyone. Integrates with all major calendars and
                    automatically handles time zones.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border border-purple-100 hover:border-purple-200 dark:border-purple-800 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-lg group bg-card">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-xl font-medium text-foreground mb-2">
                    Intelligent Invites
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    Send beautiful, branded invites with one click. Automatic
                    reminders, join links, and agenda sharing keep everyone
                    prepared.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border border-purple-100 hover:border-purple-200 dark:border-purple-800 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-lg group bg-card">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-xl font-medium text-foreground mb-2">
                    Privacy First
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    End-to-end encryption, waiting rooms, and granular
                    permissions. Your conversations stay private with
                    enterprise-grade security.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Additional Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Zap,
                  title: 'Lightning Fast',
                  desc: 'Join meetings in under 2 seconds',
                },
                {
                  icon: Globe,
                  title: 'Global CDN',
                  desc: 'Crystal clear quality worldwide',
                },
                {
                  icon: Lock,
                  title: 'Secure by Design',
                  desc: 'Zero-knowledge architecture',
                },
                {
                  icon: Video,
                  title: 'HD Quality',
                  desc: '4K video with spatial audio',
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/40 dark:hover:to-indigo-900/40 transition-all duration-300"
                >
                  <feature.icon className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
                  <h3 className="font-medium text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="pricing" className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose the plan that fits your needs. Always know what you'll
                pay.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card className="border border-purple-100 hover:border-purple-200 dark:border-purple-800 dark:hover:border-purple-700 transition-all bg-card">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-lg font-medium mb-3">
                    Starter
                  </CardTitle>
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    Free
                  </div>
                  <CardDescription>Perfect for personal use</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Up to 3 participants',
                    '40-minute meetings',
                    'Basic scheduling',
                    'Standard support',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                  <Button className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 font-medium">
                    Get Started
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 dark:border-purple-700 shadow-xl scale-105 relative bg-card">
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium px-3 py-1">
                  Most Popular
                </Badge>
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-lg font-medium mb-3">
                    Pro
                  </CardTitle>
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    $12
                    <span className="text-lg text-muted-foreground font-normal">
                      /month
                    </span>
                  </div>
                  <CardDescription>For growing teams</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Up to 100 participants',
                    'Unlimited meetings',
                    'Advanced scheduling',
                    'Priority support',
                    'Recording & transcripts',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                  <Button className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 font-medium">
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-purple-100 hover:border-purple-200 dark:border-purple-800 dark:hover:border-purple-700 transition-all bg-card">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-lg font-medium mb-3">
                    Enterprise
                  </CardTitle>
                  <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    Custom
                  </div>
                  <CardDescription>For large organizations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Unlimited participants',
                    'Custom branding',
                    'Advanced analytics',
                    '24/7 support',
                    'SSO integration',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full mt-6 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950 font-medium"
                  >
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        {/* CTA Section */}
        <section
          id="contact"
          className="py-20 bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Ready to transform your meetings?
            </h2>
            <p className="text-lg text-purple-100 mb-8">
              Join thousands of teams who've already made the switch to better
              video conferencing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/dashboard">
                <Button
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-gray-100 font-medium px-8 py-6 shadow-lg hover:shadow-white/25 transition-all duration-300"
                >
                  Start Your First Meeting
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                onClick={handleEmailSubmit}
                className=" text-black dark:text-white hover:text-purple-600 font-medium px-8 py-6 transition-all duration-300"
              >
                Schedule a Demo
              </Button>
            </div>
          </div>
        </section>
        {/* Footer */}
        <footer className="bg-muted/50 dark:bg-muted/20 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    meetlite
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  The future of video conferencing, designed for modern teams.
                </p>
              </div>
              <div>
                <h3 className="font-medium mb-3 text-foreground">Product</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Security
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Integrations
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-3 text-foreground">Company</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      About
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Blog
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Careers
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-3 text-foreground">Support</h3>
                <ul className="space-y-2 text-muted-foreground text-sm">
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Status
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="hover:text-foreground transition-colors"
                    >
                      Privacy
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-border mt-8 pt-6 text-center">
              <p className="text-muted-foreground text-sm">
                &copy; 2024 meetlite. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
};

export default Landing;
