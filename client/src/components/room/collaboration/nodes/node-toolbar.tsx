import { Plus, Settings2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      {/* Add Node - Styled like language selector */}
      <div className="flex items-center gap-2">
        <Select onValueChange={(value) => onCreateNode(value as NodeType)}>
          <SelectTrigger className="w-40 h-10 rounded-full bg-white text-black">
            <Plus className="h-4 w-4 " />
            <SelectValue placeholder="Add Node" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="input">Input Node</SelectItem>
            <SelectItem value="default">Default Node</SelectItem>
            <SelectItem value="output">Output Node</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Edge Style - Styled like language selector */}
      <div className="flex items-center gap-2">
        <Select
          onValueChange={(value) => onEdgeStyleChange(value as EdgeStyle)}
        >
          <SelectTrigger className="w-40 h-10 rounded-full bg-white text-black">
            <Settings2 className="h-4 w-4 " />
            <SelectValue placeholder="Edge Style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default Edge</SelectItem>
            <SelectItem value="straight">Straight Edge</SelectItem>
            <SelectItem value="step">Step Edge</SelectItem>
            <SelectItem value="smoothstep">Smooth Step Edge</SelectItem>
            <SelectItem value="bezier">Bezier Edge</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
