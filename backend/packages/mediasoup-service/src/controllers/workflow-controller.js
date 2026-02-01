/**
 * Workflow Controller - Handles workflow operation logic
 * This applies CRDT-style operations to workflow data
 * 
 * The workflow sync uses an Operational Transformation (OT) approach:
 * - Each operation is versioned and timestamped
 * - Operations are idempotent (applying the same operation twice has no effect)
 * - Concurrent operations are merged rather than conflicting
 */

/**
 * Validate an operation before applying
 * @param {Object} workflowData - Current workflow data
 * @param {Object} operation - The operation to validate
 * @returns {Object} - { valid: boolean, reason?: string }
 */
export const validateOperation = (workflowData, operation) => {
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
      const nodeExists = workflowData.nodes?.some(n => n.id === operation.nodeId);
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
        const sourceExists = workflowData.nodes?.some(n => n.id === operation.edge.source);
        const targetExists = workflowData.nodes?.some(n => n.id === operation.edge.target);
        if (!sourceExists || !targetExists) {
          // Allow edge creation if nodes might be created in concurrent operations
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
 * @param {Object} workflowData - Current workflow data with nodes and edges
 * @param {Object} operation - The operation to apply
 * @param {Object} options - Optional settings { skipValidation: boolean }
 * @returns {Object} - New workflow data with the operation applied
 */
export const applyWorkflowOperation = (workflowData, operation, options = {}) => {
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
          (n) => n.id === operation.node.id
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
        newData.nodes = newData.nodes.map((node) =>
          node.id === operation.nodeId
            ? { ...node, ...(operation.node || operation.data) }
            : node
        );
      }
      break;

    case 'delete_node':
      if (operation.nodeId) {
        newData.nodes = newData.nodes.filter(
          (node) => node.id !== operation.nodeId
        );
        // Also remove connected edges
        newData.edges = newData.edges.filter(
          (edge) =>
            edge.source !== operation.nodeId && edge.target !== operation.nodeId
        );
      }
      break;

    case 'add_edge':
      if (operation.edge) {
        const existingEdgeIndex = newData.edges.findIndex(
          (e) => e.id === operation.edge.id
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
        newData.edges = newData.edges.map((edge) =>
          edge.id === operation.edgeId
            ? { ...edge, ...(operation.edge || operation.edgeData) }
            : edge
        );
      }
      break;

    case 'delete_edge':
      if (operation.edgeId) {
        newData.edges = newData.edges.filter(
          (edge) => edge.id !== operation.edgeId
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
 * Uses Last-Write-Wins (LWW) for node properties and union for nodes/edges
 * @param {Object} localState - Local workflow state
 * @param {Object} remoteState - Remote workflow state
 * @returns {Object} - Merged workflow state
 */
export const mergeWorkflowStates = (localState, remoteState) => {
  const merged = {
    nodes: [],
    edges: [],
    version: Math.max(localState.version || 0, remoteState.version || 0) + 1,
    lastModified: new Date().toISOString(),
  };

  // Create maps for efficient lookup
  const localNodeMap = new Map((localState.nodes || []).map(n => [n.id, n]));
  const remoteNodeMap = new Map((remoteState.nodes || []).map(n => [n.id, n]));
  const localEdgeMap = new Map((localState.edges || []).map(e => [e.id, e]));
  const remoteEdgeMap = new Map((remoteState.edges || []).map(e => [e.id, e]));

  // Merge nodes - union of both, with LWW for conflicts
  const allNodeIds = new Set([...localNodeMap.keys(), ...remoteNodeMap.keys()]);
  for (const nodeId of allNodeIds) {
    const localNode = localNodeMap.get(nodeId);
    const remoteNode = remoteNodeMap.get(nodeId);

    if (localNode && remoteNode) {
      // Both have the node - use LWW based on position changes (more recent wins)
      // In practice, merge properties
      merged.nodes.push({
        ...localNode,
        ...remoteNode,
        // Keep the most recent position
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
    const localEdge = localEdgeMap.get(edgeId);
    const remoteEdge = remoteEdgeMap.get(edgeId);

    if (localEdge && remoteEdge) {
      // Both have the edge - merge properties
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
  const nodeIds = new Set(merged.nodes.map(n => n.id));
  merged.edges = merged.edges.filter(
    edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return merged;
};

/**
 * Calculate the difference between two workflow states
 * @param {Object} oldState - Previous workflow state
 * @param {Object} newState - Current workflow state
 * @returns {Object} - Operations needed to transform oldState to newState
 */
export const calculateWorkflowDiff = (oldState, newState) => {
  const operations = [];

  const oldNodeMap = new Map((oldState.nodes || []).map(n => [n.id, n]));
  const newNodeMap = new Map((newState.nodes || []).map(n => [n.id, n]));
  const oldEdgeMap = new Map((oldState.edges || []).map(e => [e.id, e]));
  const newEdgeMap = new Map((newState.edges || []).map(e => [e.id, e]));

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
