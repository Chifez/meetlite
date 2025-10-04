import React from 'react';
import AnimatedSection from '@/components/ui/animated-section';

const companies = [
  { name: 'TechFlow', logo: 'TF' },
  { name: 'GrowthCo', logo: 'GC' },
  { name: 'StartupXYZ', logo: 'SX' },
  { name: 'InnovateLab', logo: 'IL' },
  { name: 'PeopleFirst', logo: 'PF' },
  { name: 'DataDriven', logo: 'DD' },
  { name: 'CloudScale', logo: 'CS' },
  { name: 'NextGen', logo: 'NG' },
  { name: 'FutureTech', logo: 'FT' },
  { name: 'SmartCorp', logo: 'SC' },
  { name: 'AgileTeam', logo: 'AT' },
  { name: 'ProSolutions', logo: 'PS' },
];

const CompanyLogosSection = () => {
  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-800/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent dark:via-gray-700/5"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimatedSection animationType="fadeIn" className="text-center mb-12">
          <h2 className="text-2xl font-heading font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Trusted by companies worldwide
          </h2>
        </AnimatedSection>

        <div className="flex flex-col items-center space-y-8">
          {/* First row */}
          <div className="flex flex-wrap justify-center gap-8">
            {companies.slice(0, 4).map((company, index) => (
              <AnimatedSection
                key={index}
                animationType="scaleIn"
                delay={index * 100}
              >
                <div className="flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
                      {company.logo}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {company.name}
                    </span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Second row */}
          <div className="flex flex-wrap justify-center gap-8">
            {companies.slice(4, 7).map((company, index) => (
              <AnimatedSection
                key={index + 4}
                animationType="scaleIn"
                delay={(index + 4) * 100}
              >
                <div className="flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
                      {company.logo}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {company.name}
                    </span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Third row */}
          <div className="flex flex-wrap justify-center gap-8">
            {companies.slice(7, 12).map((company, index) => (
              <AnimatedSection
                key={index + 7}
                animationType="scaleIn"
                delay={(index + 7) * 100}
              >
                <div className="flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
                      {company.logo}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {company.name}
                    </span>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyLogosSection;
