import SEO from '@/components/SEO';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

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
