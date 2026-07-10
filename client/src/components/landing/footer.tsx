import Logo from '@/components/logo';
import { Link } from 'react-router-dom';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Support: [
    { label: 'Help center', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'Privacy policy', href: '#' },
    { label: 'Terms of service', href: '#' },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          {/* Brand column */}
          <div className="col-span-2 space-y-6">
            <Logo />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              The collaborative meeting platform built for teams. <br/>
              Meet, and actually build something.
            </p>
            <div className="flex gap-4 pt-2">
              <Link to="/signup" className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                Get started for free &rarr;
              </Link>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section} className="space-y-4">
              <h4 className="text-xs font-bold tracking-wider uppercase text-foreground">
                {section}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MeetLite, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link to="/signup" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
