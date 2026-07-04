/**
 * Workflow Controller - Handles workflow operation logic
 * This applies CRDT-style operations to workflow data
 */

/**
 * Validate an operation before applying
 */
export const validateOperation = (workflowData: any, operation: any): { valid: boolean; reason?: string } => {
  if (!operation || !operation.type) {
    return { valid: false, reason: 'Invalid operation: missing type' };
  }

  switch (operation.type) {
    case 'add_node':
      if (!operation.node || !operation.node.id) {
        return { valid: false, reason: 'add_node: missing node or node.id' };
      }
      break;

    case 'update_node':
    case 'delete_node':
      if (!operation.nodeId) {
        return { valid: false, reason: `${operation.type}: missing nodeId` };
      }
      // Check if node exists for update/delete
      const nodeExists = workflowData.nodes?.some((n: any) => n.id === operation.nodeId);
      if (!nodeExists && operation.type === 'update_node') {
        return { valid: false, reason: 'update_node: node does not exist' };
      }
      break;

    case 'add_edge':
      if (!operation.edge || !operation.edge.id) {
        return { valid: false, reason: 'add_edge: missing edge or edge.id' };
      }
      // Validate source and target nodes exist
      if (operation.edge.source && operation.edge.target) {
        const sourceExists = workflowData.nodes?.some((n: any) => n.id === operation.edge.source);
        const targetExists = workflowData.nodes?.some((n: any) => n.id === operation.edge.target);
        if (!sourceExists || !targetExists) {
          console.warn('add_edge: source or target node may not exist yet');
        }
      }
      break;

    case 'update_edge':
    case 'delete_edge':
      if (!operation.edgeId) {
        return { valid: false, reason: `${operation.type}: missing edgeId` };
      }
      break;

    default:
      return { valid: false, reason: `Unknown operation type: ${operation.type}` };
  }

  return { valid: true };
};

/**
 * Apply a workflow operation to the current workflow data
 */
export const applyWorkflowOperation = (workflowData: any, operation: any, options: any = {}) => {
  // Create a deep copy of the workflow data
  const newData = JSON.parse(JSON.stringify(workflowData));

  // Initialize arrays if they don't exist
  if (!newData.nodes) newData.nodes = [];
  if (!newData.edges) newData.edges = [];
  
  // Validate operation if not skipped
  if (!options.skipValidation) {
    const validation = validateOperation(newData, operation);
    if (!validation.valid) {
      console.warn('Invalid workflow operation:', validation.reason);
      return newData; // Return unchanged data
    }
  }

  switch (operation.type) {
    case 'add_node':
      if (operation.node) {
        const existingNodeIndex = newData.nodes.findIndex(
          (n: any) => n.id === operation.node.id
        );
        if (existingNodeIndex >= 0) {
          // Update existing node with new data
          newData.nodes[existingNodeIndex] = {
            ...newData.nodes[existingNodeIndex],
            ...operation.node,
          };
        } else {
          // Add new node
          newData.nodes = [...newData.nodes, operation.node];
        }
      }
      break;

    case 'update_node':
      if (operation.nodeId && (operation.data || operation.node)) {
        newData.nodes = newData.nodes.map((node: any) =>
          node.id === operation.nodeId
            ? { ...node, ...(operation.node || operation.data) }
            : node
        );
      }
      break;

    case 'delete_node':
      if (operation.nodeId) {
        newData.nodes = newData.nodes.filter(
          (node: any) => node.id !== operation.nodeId
        );
        // Also remove connected edges
        newData.edges = newData.edges.filter(
          (edge: any) =>
            edge.source !== operation.nodeId && edge.target !== operation.nodeId
        );
      }
      break;

    case 'add_edge':
      if (operation.edge) {
        const existingEdgeIndex = newData.edges.findIndex(
          (e: any) => e.id === operation.edge.id
        );
        if (existingEdgeIndex >= 0) {
          // Update existing edge with new data
          newData.edges[existingEdgeIndex] = {
            ...newData.edges[existingEdgeIndex],
            ...operation.edge,
          };
        } else {
          // Add new edge
          newData.edges = [...newData.edges, operation.edge];
        }
      }
      break;

    case 'update_edge':
      if (operation.edgeId && (operation.edgeData || operation.edge)) {
        newData.edges = newData.edges.map((edge: any) =>
          edge.id === operation.edgeId
            ? { ...edge, ...(operation.edge || operation.edgeData) }
            : edge
        );
      }
      break;

    case 'delete_edge':
      if (operation.edgeId) {
        newData.edges = newData.edges.filter(
          (edge: any) => edge.id !== operation.edgeId
        );
      }
      break;

    default:
      console.warn(`Unknown workflow operation type: ${operation.type}`);
  }

  // Update modification tracking
  newData.lastModified = new Date().toISOString();
  newData.lastOperationType = operation.type;

  return newData;
};

/**
 * Merge two workflow states (for conflict resolution)
 */
export const mergeWorkflowStates = (localState: any, remoteState: any) => {
  const merged: any = {
    nodes: [],
    edges: [],
    version: Math.max(localState.version || 0, remoteState.version || 0) + 1,
    lastModified: new Date().toISOString(),
  };

  // Create maps for efficient lookup
  const localNodeMap = new Map((localState.nodes || []).map((n: any) => [n.id, n]));
  const remoteNodeMap = new Map((remoteState.nodes || []).map((n: any) => [n.id, n]));
  const localEdgeMap = new Map((localState.edges || []).map((e: any) => [e.id, e]));
  const remoteEdgeMap = new Map((remoteState.edges || []).map((e: any) => [e.id, e]));

  // Merge nodes - union of both, with LWW for conflicts
  const allNodeIds = new Set([...localNodeMap.keys(), ...remoteNodeMap.keys()]);
  for (const nodeId of allNodeIds) {
    const localNode = localNodeMap.get(nodeId) as any;
    const remoteNode = remoteNodeMap.get(nodeId) as any;

    if (localNode && remoteNode) {
      merged.nodes.push({
        ...localNode,
        ...remoteNode,
        position: remoteNode.position || localNode.position,
        data: {
          ...localNode.data,
          ...remoteNode.data,
        },
      });
    } else if (localNode) {
      merged.nodes.push(localNode);
    } else if (remoteNode) {
      merged.nodes.push(remoteNode);
    }
  }

  // Merge edges - union of both, with LWW for conflicts
  const allEdgeIds = new Set([...localEdgeMap.keys(), ...remoteEdgeMap.keys()]);
  for (const edgeId of allEdgeIds) {
    const localEdge = localEdgeMap.get(edgeId) as any;
    const remoteEdge = remoteEdgeMap.get(edgeId) as any;

    if (localEdge && remoteEdge) {
      merged.edges.push({
        ...localEdge,
        ...remoteEdge,
      });
    } else if (localEdge) {
      merged.edges.push(localEdge);
    } else if (remoteEdge) {
      merged.edges.push(remoteEdge);
    }
  }

  // Remove edges that reference non-existent nodes
  const nodeIds = new Set(merged.nodes.map((n: any) => n.id));
  merged.edges = merged.edges.filter(
    (edge: any) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return merged;
};

/**
 * Calculate the difference between two workflow states
 */
export const calculateWorkflowDiff = (oldState: any, newState: any) => {
  const operations: any[] = [];

  const oldNodeMap = new Map((oldState.nodes || []).map((n: any) => [n.id, n]));
  const newNodeMap = new Map((newState.nodes || []).map((n: any) => [n.id, n]));
  const oldEdgeMap = new Map((oldState.edges || []).map((e: any) => [e.id, e]));
  const newEdgeMap = new Map((newState.edges || []).map((e: any) => [e.id, e]));

  // Find added/updated nodes
  for (const [nodeId, node] of newNodeMap) {
    const oldNode = oldNodeMap.get(nodeId);
    if (!oldNode) {
      operations.push({ type: 'add_node', node });
    } else if (JSON.stringify(oldNode) !== JSON.stringify(node)) {
      operations.push({ type: 'update_node', nodeId, data: node });
    }
  }

  // Find deleted nodes
  for (const [nodeId] of oldNodeMap) {
    if (!newNodeMap.has(nodeId)) {
      operations.push({ type: 'delete_node', nodeId });
    }
  }

  // Find added/updated edges
  for (const [edgeId, edge] of newEdgeMap) {
    const oldEdge = oldEdgeMap.get(edgeId);
    if (!oldEdge) {
      operations.push({ type: 'add_edge', edge });
    } else if (JSON.stringify(oldEdge) !== JSON.stringify(edge)) {
      operations.push({ type: 'update_edge', edgeId, edgeData: edge });
    }
  }

  // Find deleted edges
  for (const [edgeId] of oldEdgeMap) {
    if (!newEdgeMap.has(edgeId)) {
      operations.push({ type: 'delete_edge', edgeId });
    }
  }

  return operations;
};
