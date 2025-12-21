import SEO from '@/components/seo';
import HeroSection from '@/components/landing/hero-section';
import FeaturesSection from '@/components/landing/feature-section';
import TestimonialsSection from '@/components/landing/testimonials-section';
import ComparisonSection from '@/components/landing/comparison-section';
import PricingSection from '@/components/landing/pricing-section';
import Footer from '@/components/landing/footer';

export default function Landing() {
  return (
    <>
      <SEO
        title="MeetLite | The collaborative meeting platform built for teams"
        description="The collaborative meeting platform built for teams"
      />
      <div className="min-h-screen transition-colors duration-300">
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <ComparisonSection />
        <PricingSection />
        <Footer />
      </div>
    </>
  );
}
