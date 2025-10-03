import { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useRoom } from '@/contexts/room-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  MoreHorizontal,
  Tag,
  FileText,
  Image,
  Zap,
  Settings as SettingsIcon,
  Send,
  Plus,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type NodeData = {
  nodeType?: 'input' | 'default' | 'output';
  title?: string;
  description?: string;
  tags?: string[];
  icon?: string;
  showAllFields?: boolean;
  details?: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
};

const nodeIcons = {
  input: Zap,
  default: SettingsIcon,
  output: Send,
};

const nodeColors = {
  input: 'bg-green-50 border-green-200',
  default: 'bg-blue-50 border-blue-200',
  output: 'bg-orange-50 border-orange-200',
};

interface CustomNodeProps {
  id: string;
  data: NodeData;
  isConnectable: boolean;
}

// TagPill component for individual tag editing
interface TagPillProps {
  tag: string;
  onRemove: () => void;
  onEdit: (newTag: string) => void;
}

const TagPill = ({ tag, onRemove, onEdit }: TagPillProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tag);

  const handleSave = () => {
    if (editValue.trim() && editValue !== tag) {
      onEdit(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(tag);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
          onBlur={handleSave}
          className="text-xs h-6 px-2"
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
      <span
        className="cursor-pointer"
        onClick={() => setIsEditing(true)}
        title="Click to edit"
      >
        {tag}
      </span>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 ml-1"
        title="Remove tag"
      >
        ×
      </button>
    </div>
  );
};

export const CustomNode = ({ id, data, isConnectable }: CustomNodeProps) => {
  const { sendWorkflowOperation, canEdit, collaborationState } = useRoom();
  const { user } = useAuth();
  const nodeData = data as NodeData;
  const { position } = data as any;

  // Single state for editing field
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // Tag editing state
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Icon selection state
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingValue, setEditingValue] = useState('');

  // Compute derived values from props using useMemo
  const title = useMemo(() => nodeData.title || '', [nodeData.title]);
  const description = useMemo(
    () => nodeData.description || '',
    [nodeData.description]
  );
  const tags = useMemo(() => nodeData.tags || [], [nodeData.tags]);

  const showAllFields = nodeData.showAllFields || false;
  const canUserEdit = user?.id ? canEdit(user.id) : false;

  // Debug logging
  console.log('CustomNode Debug:', {
    nodeId: id,
    authUser: user,
    authUserId: user?.id,
    collaborationState: collaborationState,
    presenterUserId: collaborationState?.presenter?.userId,
    canUserEdit,
    showAllFields,
    showOptions,
  });

  const toggleShowAllFields = useCallback(() => {
    sendWorkflowOperation({
      type: 'update_node',
      nodeId: id,
      node: {
        id,
        type: 'custom',
        position,
        data: {
          ...nodeData,
          showAllFields: !nodeData.showAllFields,
        },
      },
    });
    setShowOptions(false);
  }, [id, nodeData, position, sendWorkflowOperation]);

  // Set editing value when entering edit mode
  const startEditing = useCallback(
    (field: string) => {
      setEditingField(field);
      setEditingValue(field === 'title' ? title : description);
    },
    [title, description]
  );

  // Handle field edit completion
  const handleFieldEdit = useCallback(
    (field: string, value: string) => {
      setEditingField(null);
      sendWorkflowOperation({
        type: 'update_node',
        nodeId: id,
        node: {
          id,
          type: 'custom',
          position,
          data: {
            ...nodeData,
            [field]: value,
          },
        },
      });
    },
    [id, nodeData, position, sendWorkflowOperation]
  );

  const handleTagsUpdate = useCallback(
    (newTags: string[]) => {
      sendWorkflowOperation({
        type: 'update_node',
        nodeId: id,
        node: {
          id,
          type: 'custom',
          position,
          data: {
            ...nodeData,
            tags: newTags,
          },
        },
      });
    },
    [id, nodeData, position, sendWorkflowOperation]
  );

  // Initialize tag editing
  const startEditingTags = useCallback(() => {
    setIsEditingTags(true);
    setEditingTags([...tags]);
    setNewTagInput('');
  }, [tags]);

  // Save tag changes
  const saveTags = useCallback(() => {
    setIsEditingTags(false);
    handleTagsUpdate(editingTags);
  }, [editingTags, handleTagsUpdate]);

  // Cancel tag editing
  const cancelTagEditing = useCallback(() => {
    setIsEditingTags(false);
    setEditingTags([...tags]);
    setNewTagInput('');
  }, [tags]);

  // Add new tag
  const addTag = useCallback(() => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !editingTags.includes(trimmedTag)) {
      setEditingTags([...editingTags, trimmedTag]);
      setNewTagInput('');
    }
  }, [newTagInput, editingTags]);

  // Remove tag
  const removeTag = useCallback(
    (tagToRemove: string) => {
      setEditingTags(editingTags.filter((tag) => tag !== tagToRemove));
    },
    [editingTags]
  );

  // Edit specific tag
  const editTag = useCallback(
    (oldTag: string, newTag: string) => {
      const trimmedNewTag = newTag.trim();
      if (trimmedNewTag && trimmedNewTag !== oldTag) {
        setEditingTags(
          editingTags.map((tag) => (tag === oldTag ? trimmedNewTag : tag))
        );
      }
    },
    [editingTags]
  );

  // Change icon
  const changeIcon = useCallback(
    (iconName: string) => {
      sendWorkflowOperation({
        type: 'update_node',
        nodeId: id,
        node: {
          id,
          type: 'custom',
          position,
          data: {
            ...nodeData,
            icon: iconName,
          },
        },
      });
      setShowIconPicker(false);
    },
    [id, nodeData, position, sendWorkflowOperation]
  );

  const type = nodeData.nodeType || 'default';
  const currentIcon = nodeData.icon
    ? nodeIcons[nodeData.icon as keyof typeof nodeIcons]
    : nodeIcons[type];

  return (
    <div
      className={cn(
        'bg-white shadow-lg rounded-lg border min-w-[250px] max-w-[300px]',
        'transition-all duration-200',
        !canUserEdit && 'cursor-default',
        canUserEdit && 'cursor-grab active:cursor-grabbing',
        'hover:shadow-xl',
        nodeColors[type]
      )}
    >
      {/* Input Handle */}
      {type !== 'output' && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable && canUserEdit}
          className={cn(
            'w-3 h-3 -ml-1.5',
            canUserEdit ? '!bg-gray-400' : '!bg-gray-300'
          )}
        />
      )}

      {/* Header with Title and Options Button */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2 flex-1">
          {(() => {
            const IconComponent = currentIcon;
            return IconComponent ? (
              <IconComponent className="w-4 h-4 text-gray-600" />
            ) : null;
          })()}
          <div className="flex-1">
            {editingField === 'title' ? (
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => handleFieldEdit('title', editingValue)}
                className="text-sm font-bold text-gray-800 bg-transparent border-none outline-none w-full"
                autoFocus
              />
            ) : (
              <div
                className={cn(
                  canUserEdit && 'cursor-text',
                  !canUserEdit && 'cursor-default'
                )}
                onDoubleClick={() => canUserEdit && startEditing('title')}
              >
                <p className="text-sm font-bold text-gray-800">
                  {title || 'Untitled'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Options Button - Only show if user can edit */}
        {canUserEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOptions(!showOptions)}
            className="h-6 w-6 p-0"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </Button>
        )}
      </div>

      {/* Conditional Fields */}
      {showAllFields && (
        <>
          {/* Tags - Below Title */}
          <div className="px-3 pb-2">
            {isEditingTags && canUserEdit ? (
              // Tag editing mode - only show if user can edit
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {editingTags.map((tag, index) => (
                    <TagPill
                      key={index}
                      tag={tag}
                      onRemove={() => removeTag(tag)}
                      onEdit={(newTag) => editTag(tag, newTag)}
                    />
                  ))}
                </div>
                {/* Add new tag input */}
                <div className="flex gap-1">
                  <Input
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    onKeyDown={(e) => e.key === 'Escape' && cancelTagEditing()}
                    placeholder="Add tag..."
                    className="flex-1 text-xs h-6"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTag}
                    className="h-6 px-2"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {/* Save/Cancel buttons */}
                <div className="flex gap-1">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveTags}
                    className="h-6 px-2 text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelTagEditing}
                    className="h-6 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Tag display mode
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className={cn(
                      'px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded',
                      canUserEdit && 'cursor-pointer hover:bg-gray-200',
                      !canUserEdit && 'cursor-default'
                    )}
                    onClick={() => canUserEdit && startEditingTags()}
                    title={canUserEdit ? 'Click to edit tags' : undefined}
                  >
                    {tag}
                  </span>
                ))}
                {tags.length === 0 && canUserEdit && (
                  <span
                    className="px-2 py-1 text-xs text-gray-400 border border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400"
                    onClick={() => startEditingTags()}
                    title="Click to add tags"
                  >
                    + Add tags
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-3 pb-2">
            <div className="mb-2">
              {editingField === 'description' ? (
                <Input
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => handleFieldEdit('description', editingValue)}
                  className="text-xs text-gray-500 bg-transparent border-none outline-none w-full"
                  autoFocus
                  placeholder="Add description..."
                />
              ) : (
                <div
                  className={cn(
                    canUserEdit && 'cursor-text',
                    !canUserEdit && 'cursor-default'
                  )}
                  onDoubleClick={() =>
                    canUserEdit && startEditing('description')
                  }
                >
                  <p className="text-xs text-gray-500">
                    {description ||
                      (canUserEdit
                        ? 'Double-click to add description...'
                        : 'No description')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Options Menu - Only show if user can edit */}
      {showOptions && canUserEdit && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[200px]">
          <div className="p-2 space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowOptions(false);
                startEditing('title');
              }}
              className="w-full justify-start"
            >
              <FileText className="w-4 h-4 mr-2" />
              Edit Title
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowOptions(false);
                startEditing('description');
              }}
              className="w-full justify-start"
            >
              <FileText className="w-4 h-4 mr-2" />
              Edit Description
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowOptions(false);
                startEditingTags();
              }}
              className="w-full justify-start"
            >
              <Tag className="w-4 h-4 mr-2" />
              Manage Tags
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowOptions(false);
                setShowIconPicker(true);
              }}
              className="w-full justify-start"
            >
              <Image className="w-4 h-4 mr-2" />
              Change Icon
            </Button>
            {canUserEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleShowAllFields}
                className="w-full justify-start"
              >
                {showAllFields ? 'Hide Fields' : 'Show All Fields'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Icon Picker - Only show if user can edit */}
      {showIconPicker && canUserEdit && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[200px]">
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium">Select Icon:</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIconPicker(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(nodeIcons).map(([name, IconComponent]) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  onClick={() => changeIcon(name)}
                  className="h-8 w-8 p-0"
                  title={name}
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Output Handle */}
      {type !== 'input' && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable && canUserEdit}
          className={cn(
            'w-3 h-3 -mr-1.5',
            canUserEdit ? '!bg-gray-400' : '!bg-gray-300'
          )}
        />
      )}
    </div>
  );
};
