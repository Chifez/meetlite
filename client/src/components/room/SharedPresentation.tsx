import React from 'react';
import { WorkflowPanel } from './collaboration/WorkflowPanel';
import { WhiteboardPanel } from './collaboration/WhiteboardPanel';

interface SharedPresentationProps {
  mode: 'workflow' | 'whiteboard';
}

export const SharedPresentation: React.FC<SharedPresentationProps> = ({
  mode,
}) => {
  return (
    <div className="w-full h-full bg-[#121212] rounded-lg overflow-hidden border border-gray-700">
      <div className="w-full h-full">
        {mode === 'workflow' ? (
          <WorkflowPanel className="w-full h-full" />
        ) : (
          <WhiteboardPanel className="w-full h-full" />
        )}
      </div>
    </div>
  );
};
