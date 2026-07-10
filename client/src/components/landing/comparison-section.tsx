import { Check, X } from 'lucide-react';

const comparisonData = [
  { feature: 'Native multiplayer canvas', meetlite: true, others: false },
  { feature: 'Component architecture diagrams', meetlite: true, others: false },
  { feature: 'Speaker-labeled AI transcripts', meetlite: true, others: false },
  { feature: 'End-to-end encryption', meetlite: true, others: true },
  { feature: 'HD video conferencing', meetlite: true, others: true },
];

const ComparisonSection = () => {
  return (
    <section id="comparison" className="py-24 bg-background border-b border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            A workspace first. <br/> A video call second.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            See how MeetLite stacks up against traditional conferencing tools.
          </p>
        </div>

        {/* Comparison table */}
        <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground w-full">
                  Feature
                </th>
                <th className="px-6 py-4 text-sm font-bold text-primary text-center whitespace-nowrap bg-primary/5">
                  MeetLite
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-muted-foreground text-center whitespace-nowrap">
                  Traditional Tools
                </th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {comparisonData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-foreground font-semibold">
                    {row.feature}
                  </td>
                  <td className="px-6 py-4 text-center bg-primary/5">
                    {row.meetlite ? (
                      <Check className="w-5 h-5 text-primary mx-auto" strokeWidth={3} />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/30 mx-auto" strokeWidth={2} />
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {row.others ? (
                      <Check className="w-5 h-5 text-muted-foreground mx-auto" strokeWidth={2} />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground/30 mx-auto" strokeWidth={2} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
