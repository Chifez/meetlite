import { Video } from 'lucide-react';
import Logo from '../Logo';

const Footer = () => {
  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-300 dark:text-gray-400 py-12 sm:py-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Logo variant="white" />
            <p className="text-gray-400 dark:text-gray-500 leading-relaxed">
              The future of video conferencing, designed for modern teams.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-semibold">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Security
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Integrations
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-semibold">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-semibold">Support</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Status
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 dark:border-gray-900 mt-12 pt-8 text-center text-gray-400 dark:text-gray-500">
          <p>&copy; 2024 meetlite. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
