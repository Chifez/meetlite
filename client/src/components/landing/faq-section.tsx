import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AnimatedSection from '@/components/ui/animated-section';

const faqs = [
  {
    question: 'How is MeetLite different from other video conferencing tools?',
    answer:
      'MeetLite combines AI-powered scheduling, enterprise-grade security, and crystal-clear video quality in one platform. Unlike other tools, our AI automatically finds the best meeting times, our global CDN ensures perfect quality worldwide, and our security features meet SOC 2 compliance standards.',
    height: 'tall',
  },
  {
    question: 'What security measures does MeetLite have?',
    answer:
      'MeetLite uses end-to-end encryption for all meetings, is SOC 2 compliant, and offers granular permission controls. We also provide secure room options, password protection, and waiting room features to ensure your sensitive discussions stay private.',
    height: 'medium',
  },
  {
    question: 'How many participants can join a meeting?',
    answer:
      'Our free plan supports up to 3 participants, Pro plan supports up to 100 participants, and Enterprise plan supports unlimited participants. All plans include HD video quality and screen sharing capabilities.',
    height: 'short',
  },
  {
    question: 'Does MeetLite integrate with calendar applications?',
    answer:
      'Yes! MeetLite integrates seamlessly with Google Calendar, Outlook, Apple Calendar, and other major calendar applications. Our AI scheduling automatically syncs availability and handles time zone conversions.',
    height: 'medium',
  },
  {
    question: 'What video quality does MeetLite support?',
    answer:
      'MeetLite supports up to 4K video quality with spatial audio. Our adaptive streaming technology automatically adjusts quality based on your internet connection to ensure the best possible experience.',
    height: 'short',
  },
  {
    question: 'Can I record meetings?',
    answer:
      'Yes, meeting recording is available on Pro and Enterprise plans. Recordings are stored securely in the cloud and can be downloaded or shared with team members. Transcripts are also automatically generated.',
    height: 'medium',
  },
  {
    question: 'Is there a mobile app available?',
    answer:
      'Yes, MeetLite has native mobile apps for iOS and Android. The mobile apps include all core features like HD video, screen sharing, chat, and calendar integration.',
    height: 'short',
  },
  {
    question: 'What kind of support do you offer?',
    answer:
      'We offer 24/7 email support for all users, priority support for Pro users, and dedicated account managers for Enterprise customers. Our help center includes comprehensive documentation and video tutorials.',
    height: 'tall',
  },
];

const FAQSection = () => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index)
        ? prev.filter((item) => item !== index)
        : [...prev, index]
    );
  };

  return (
    <section
      id="faq"
      className="py-20 bg-white dark:bg-gray-900 relative overflow-hidden transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/30 dark:from-blue-900/10 to-transparent"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatedSection
          animationType="fadeIn"
          className="text-center space-y-6 mb-16"
        >
          <h2 className="text-fluid-4xl font-heading font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-100 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-fluid-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Everything you need to know about MeetLite. Can't find what you're
            looking for?
            <a
              href="#contact"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              {' '}
              Contact our support team
            </a>
            .
          </p>
        </AnimatedSection>

        {/* Single Column Layout */}
        <div className="max-w-4xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <AnimatedSection
              key={index}
              animationType="scaleIn"
              delay={index * 100}
            >
              <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800">
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleItem(index)}
                    className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4 leading-tight">
                      {faq.question}
                    </h3>
                    <div className="flex-shrink-0">
                      {openItems.includes(index) ? (
                        <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openItems.includes(index)
                        ? 'max-h-96 opacity-100'
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-8 pb-6">
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        {/* Contact CTA */}
        <AnimatedSection
          animationType="slideUp"
          delay={200}
          className="mt-16 text-center"
        >
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Still have questions?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Our support team is here to help you get the most out of
                MeetLite.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="mailto:support@meetlite.com"
                  className="text-center inline-flex justify-center items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors duration-200"
                >
                  Contact Support
                </a>
                <a
                  href="#pricing"
                  className="text-center inline-flex justify-center items-center px-6 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl font-semibold transition-colors duration-200"
                >
                  View Pricing
                </a>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default FAQSection;
