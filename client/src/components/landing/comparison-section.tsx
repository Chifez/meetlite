import { Check, X } from 'lucide-react';
import { motion } from 'motion/react';

const comparisonData = [
  { feature: 'HD & 4K video quality', meetlite: true, others: true },
  { feature: 'AI meeting transcription', meetlite: true, others: false },
  { feature: 'Smart scheduling assistant', meetlite: true, others: false },
  { feature: 'End-to-end encryption', meetlite: true, others: true },
  { feature: 'Workspace branding', meetlite: true, others: false },
  { feature: 'Unlimited meeting duration', meetlite: true, others: false },
  { feature: 'Guest access without sign-up', meetlite: true, others: false },
  { feature: 'Compliance audit logs', meetlite: true, others: false },
];

const ComparisonSection = () => {
  return (
    <section id="comparison" className="py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-label mb-3">How we compare</p>
          <h2 className="text-[1.875rem] sm:text-[2.5rem] font-bold text-foreground tracking-[-0.03em]">
            Built for work, not workarounds.
          </h2>
          <p className="mt-3 text-[0.9375rem] text-muted-foreground max-w-xl mx-auto">
            MeetLite ships the features your team actually needs — without the enterprise price tag.
          </p>
        </div>

        {/* Comparison table */}
        <motion.div
          className="border border-border rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4 }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3.5 text-[0.8125rem] font-semibold text-muted-foreground w-full">
                  Feature
                </th>
                <th className="px-5 py-3.5 text-[0.8125rem] font-semibold text-primary text-center whitespace-nowrap">
                  MeetLite
                </th>
                <th className="px-5 py-3.5 text-[0.8125rem] font-semibold text-muted-foreground text-center whitespace-nowrap">
                  Others
                </th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {comparisonData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors duration-100"
                >
                  <td className="px-5 py-3.5 text-[0.875rem] text-foreground font-medium">
                    {row.feature}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {row.meetlite ? (
                      <Check className="w-4 h-4 text-primary mx-auto" strokeWidth={2.5} />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 mx-auto" strokeWidth={2} />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {row.others ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2.5} />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 mx-auto" strokeWidth={2} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonSection;
