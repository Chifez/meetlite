import { ReactNode } from 'react';

interface BrowserMockupProps {
  children: ReactNode;
  url?: string;
}

export const BrowserMockup = ({
  children,
  url = 'meetlite.app/integrations',
}: BrowserMockupProps) => {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Browser Frame */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-t-lg border border-gray-300 dark:border-gray-700 p-3">
        {/* Traffic Lights / Window Controls */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          {/* Address Bar */}
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-md px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 border border-gray-200 dark:border-gray-700">
            <div className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            </div>
            <span className="flex-1 truncate font-mono text-xs">{url}</span>
            <div className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-gray-900 rounded-b-lg border-x border-b border-gray-300 dark:border-gray-700 shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
};
