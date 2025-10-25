import SEO from '@/components/seo';
import HeroSection from '@/components/landing/hero-section';
import FeaturesSection from '@/components/landing/feature-section';
import PricingSection from '@/components/landing/pricing-section';
import CTASection from '@/components/landing/cta-section';
import Footer from '@/components/landing/footer';

export default function Landing() {
  return (
    <>
      <SEO
        title="MeetLite - Meet Better, Meet Lighter"
        description="Experience seamless video conferencing with advanced scheduling, smart invites, and enterprise-grade privacy."
      />
      <div className="min-h-screen transition-colors duration-300">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}
