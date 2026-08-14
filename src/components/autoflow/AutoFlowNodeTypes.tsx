import { Handle, Position, NodeProps } from '@xyflow/react';
import { Play, Square, FileText, Clock, Diamond, GitBranch } from 'lucide-react';
import { AutoFlowNodeData } from '../../types';

type AutoFlowRFNode = NodeProps & { data: AutoFlowNodeData };

export function StartNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-round" style={{ background: 'var(--success)' }}>
      <Play size={14} color="#fff" fill="#fff" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function EndNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-round" style={{ background: 'var(--danger)' }}>
      <Square size={12} color="#fff" fill="#fff" />
      <span>{data.label}</span>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export function StateNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-rect" style={{ background: 'var(--accent-create)' }}>
      <Handle type="target" position={Position.Left} />
      <FileText size={14} color="#fff" />
      <span>{data.label}</span>
      {data.action && <span className="autoflow-node-badge">{data.action}</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function WaitNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-rect" style={{ background: 'var(--warning)' }}>
      <Handle type="target" position={Position.Left} />
      <Clock size={14} color="#fff" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function DecisionNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-diamond" style={{ background: '#7c3aed' }}>
      <Handle type="target" position={Position.Left} />
      <Diamond size={14} color="#fff" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} id="true" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '65%' }} />
    </div>
  );
}

export function GatewayNode({ data }: AutoFlowRFNode) {
  return (
    <div className="autoflow-node autoflow-node-rect" style={{ background: 'var(--accent)' }}>
      <Handle type="target" position={Position.Left} />
      <GitBranch size={14} color="#fff" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} id="out-0" style={{ top: '30%' }} />
      <Handle type="source" position={Position.Right} id="out-1" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="out-2" style={{ top: '70%' }} />
    </div>
  );
}

/** Non-interactive background node representing one swimlane — nodes with a matching
 * parentId are clipped/positioned relative to this via React Flow's own group-node support. */
export function LaneNode({ data }: NodeProps & { data: { label: string } }) {
  return (
    <div className="autoflow-lane-bg">
      <span className="autoflow-lane-label">{data.label}</span>
    </div>
  );
}

export const autoFlowNodeTypes = {
  start: StartNode,
  end: EndNode,
  state: StateNode,
  wait: WaitNode,
  decision: DecisionNode,
  gateway: GatewayNode,
  lane: LaneNode,
};
