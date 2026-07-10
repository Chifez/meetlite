import SEO from '@/components/seo';
import HeroSection from '@/components/landing/hero-section';
import LogoCloudSection from '@/components/landing/logo-cloud-section';
import FeaturesSection from '@/components/landing/feature-section';
import UseCasesSection from '@/components/landing/use-cases-section';
import SecuritySection from '@/components/landing/security-section';
import TestimonialsSection from '@/components/landing/testimonials-section';
import ComparisonSection from '@/components/landing/comparison-section';
import PricingSection from '@/components/landing/pricing-section';
import FaqSection from '@/components/landing/faq-section';
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
        <LogoCloudSection />
        <FeaturesSection />
        <UseCasesSection />
        <SecuritySection />
        <TestimonialsSection />
        <ComparisonSection />
        <PricingSection />
        <FaqSection />
        <Footer />
      </div>
    </>
  );
}
