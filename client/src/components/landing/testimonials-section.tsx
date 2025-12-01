import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CEO, TechStart Inc.',
    content:
      'MeetLite has transformed how we conduct meetings. The smart scheduling alone saves us hours every week.',
    rating: 5,
  },
  {
    name: 'Michael Rodriguez',
    role: 'Product Manager, DesignCo',
    content:
      'The video quality is incredible, and the interface is so intuitive. Our team loves it.',
    rating: 5,
  },
  {
    name: 'Emily Johnson',
    role: 'Director of Operations, Growth Labs',
    content:
      'Finally, a video conferencing tool that actually works. The privacy features give us peace of mind.',
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground">
            Trusted by teams
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            See what our users have to say about their experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="border-border bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <div className="relative">
                  <Quote className="w-8 h-8 text-primary/20 absolute -top-2 -left-2" />
                  <p className="text-foreground leading-relaxed relative z-10 pl-4">
                    {testimonial.content}
                  </p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="font-semibold text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
