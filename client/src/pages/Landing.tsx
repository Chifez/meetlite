import SEO from '@/components/seo';
import HeroSection from '@/components/landing/hero-section';
import CompanyLogosSection from '@/components/landing/company-logos-section';
import FeaturesSection from '@/components/landing/feature-section';
import TestimonialsSection from '@/components/landing/testimonials-section';
import PricingSection from '@/components/landing/pricing-section';
import FAQSection from '@/components/landing/faq-section';
import CTASection from '@/components/landing/cta-section';
import Footer from '@/components/landing/footer';

export default function Landing() {
  return (
    <>
      <SEO
        title="MeetLite - Video meetings that actually work"
        description="Join thousands of teams who've eliminated meeting friction with AI-powered scheduling, crystal-clear video, and enterprise security that just works."
      />
      <div className="min-h-screen transition-colors duration-300">
        <HeroSection />
        <CompanyLogosSection />
        <FeaturesSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
