import { Button } from '@/components/ui/button';
import { Plus, Settings2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NodeType = 'input' | 'default' | 'output';
type EdgeStyle = 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';

interface NodeToolbarProps {
  onCreateNode: (type: NodeType) => void;
  onEdgeStyleChange: (style: EdgeStyle) => void;
}

export const NodeToolbar = ({
  onCreateNode,
  onEdgeStyleChange,
}: NodeToolbarProps) => {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
      {/* Add Node - Pill shaped */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-full gap-2 px-4">
            <Plus className="h-4 w-4" />
            Add Node
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onCreateNode('input')}>
            Input Node
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateNode('default')}>
            Default Node
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateNode('output')}>
            Output Node
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings - Fully rounded */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onEdgeStyleChange('default')}>
            Default Edge
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdgeStyleChange('straight')}>
            Straight Edge
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdgeStyleChange('step')}>
            Step Edge
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdgeStyleChange('smoothstep')}>
            Smooth Step Edge
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdgeStyleChange('bezier')}>
            Bezier Edge
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
