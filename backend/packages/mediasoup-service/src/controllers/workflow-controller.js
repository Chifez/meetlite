/**
 * Workflow Controller - Handles workflow operation logic
 * This applies CRDT-style operations to workflow data
 */

/**
 * Apply a workflow operation to the current workflow data
 * @param {Object} workflowData - Current workflow data with nodes and edges
 * @param {Object} operation - The operation to apply
 * @returns {Object} - New workflow data with the operation applied
 */
export const applyWorkflowOperation = (workflowData, operation) => {
  // Create a deep copy of the workflow data
  const newData = JSON.parse(JSON.stringify(workflowData));

  // Initialize arrays if they don't exist
  if (!newData.nodes) newData.nodes = [];
  if (!newData.edges) newData.edges = [];

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

  return newData;
};
