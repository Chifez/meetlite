import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';
import AnimatedSection from '@/components/ui/animated-section';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'VP of Engineering',
    company: 'TechFlow',
    avatar: 'SC',
    content:
      'MeetLite has transformed how our distributed team collaborates. The AI scheduling alone saves us 5 hours per week, and the video quality is consistently excellent.',
    rating: 5,
    highlight: 'Saves 5 hours per week',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Head of Sales',
    company: 'GrowthCo',
    avatar: 'MR',
    content:
      'Our client meetings have never been smoother. The crystal-clear video and reliable connection mean we never miss important details or lose momentum.',
    rating: 5,
    highlight: 'Never miss details',
  },
  {
    name: 'Emily Watson',
    role: 'CEO',
    company: 'StartupXYZ',
    avatar: 'EW',
    content:
      'As a startup, we needed enterprise-grade security without enterprise prices. MeetLite delivers exactly that - secure, reliable, and affordable.',
    rating: 5,
    highlight: 'Enterprise security',
  },
  {
    name: 'David Kim',
    role: 'Product Manager',
    company: 'InnovateLab',
    avatar: 'DK',
    content:
      'The global CDN ensures our international team always has perfect video quality. No more pixelated faces or audio dropouts during critical meetings.',
    rating: 5,
    highlight: 'Perfect global quality',
  },
  {
    name: 'Lisa Thompson',
    role: 'HR Director',
    company: 'PeopleFirst',
    avatar: 'LT',
    content:
      'Scheduling interviews across time zones used to be a nightmare. Now our AI handles everything automatically, and candidates love the seamless experience.',
    rating: 5,
    highlight: 'Zero scheduling stress',
  },
  {
    name: 'James Wilson',
    role: 'CTO',
    company: 'DataDriven',
    avatar: 'JW',
    content:
      'The security features give us confidence for sensitive discussions. End-to-end encryption and SOC 2 compliance mean our data stays protected.',
    rating: 5,
    highlight: 'Bank-level security',
  },
  {
    name: 'Anna Martinez',
    role: 'Marketing Director',
    company: 'BrandCo',
    avatar: 'AM',
    content:
      'The recording and transcription features are game-changers for our content team. We can focus on the conversation knowing everything is captured perfectly.',
    rating: 5,
    highlight: 'Perfect recordings',
  },
  {
    name: 'Robert Chen',
    role: 'Operations Manager',
    company: 'LogiFlow',
    avatar: 'RC',
    content:
      'Integration with our existing calendar system was seamless. The AI scheduling understands our complex availability patterns better than any human assistant.',
    rating: 5,
    highlight: 'Smart integration',
  },
  {
    name: 'Maria Garcia',
    role: 'Team Lead',
    company: 'DevWorks',
    avatar: 'MG',
    content:
      'The mobile app is just as powerful as the desktop version. Our team can join meetings from anywhere without compromising on quality or features.',
    rating: 5,
    highlight: 'Mobile excellence',
  },
];

const TestimonialsSection = () => {
  return (
    <section
      id="testimonials"
      className="py-20 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-900/20 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatedSection
          animationType="fadeIn"
          className="text-center space-y-6 mb-16"
        >
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-100 bg-clip-text text-transparent">
            Loved by teams worldwide
          </h2>
          <p className="text-fluid-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            See why thousands of companies trust MeetLite for their most
            important meetings
          </p>
        </AnimatedSection>

        {/* Masonry Layout */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((testimonial, index) => (
            <AnimatedSection
              key={index}
              animationType="scaleIn"
              delay={index * 100}
              className="break-inside-avoid mb-6"
            >
              <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover-lift">
                <CardContent className="p-6 space-y-4">
                  {/* Quote Icon */}
                  <div className="flex justify-start">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                      <Quote className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-yellow-400 fill-current"
                      />
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                    "{testimonial.content}"
                  </blockquote>

                  {/* Highlight */}
                  <div className="pt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                      {testimonial.highlight}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="flex items-center space-x-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {testimonial.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
