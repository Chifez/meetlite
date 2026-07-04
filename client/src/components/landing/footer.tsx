import Logo from '@/components/logo';
import { Link } from 'react-router-dom';

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '#' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'Changelog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '#contact' },
  ],
  Support: [
    { label: 'Help center', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'System status', href: '#' },
    { label: 'Privacy policy', href: '#' },
    { label: 'Terms of service', href: '#' },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Logo />
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed max-w-[200px]">
              Professional video conferencing built for modern teams.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section} className="space-y-3">
              <h4 className="text-[0.75rem] font-semibold tracking-[0.06em] uppercase text-muted-foreground">
                {section}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[0.8125rem] text-muted-foreground hover:text-foreground transition-colors duration-150"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-12 pt-6 border-t border-border">
          <p className="text-[0.75rem] text-muted-foreground">
            © {new Date().getFullYear()} MeetLite, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link to="/signup" className="text-[0.75rem] text-muted-foreground hover:text-foreground transition-colors">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
