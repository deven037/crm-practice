import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import { getById, newId, upsert } from '../data/store';
import { AutoFlowCondition, AutoFlowEdge, AutoFlowLane, AutoFlowMilestone, AutoFlowNode, AutoFlowNodeType, AutoFlowProcess } from '../types';
import { Spinner } from '../components/Spinner';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { getAllModuleFields, getConditionFields, ModuleFieldDef } from '../utils/moduleFields';
import { autoFlowNodeTypes } from '../components/autoflow/AutoFlowNodeTypes';
import { classNames } from '../utils';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;
const LANE_PADDING = 24;

const PALETTE: { type: AutoFlowNodeType; label: string; color: string }[] = [
  { type: 'start', label: 'Start', color: 'var(--success)' },
  { type: 'end', label: 'End', color: 'var(--danger)' },
  { type: 'state', label: 'State', color: 'var(--accent-create)' },
  { type: 'wait', label: 'Wait', color: 'var(--warning)' },
  { type: 'decision', label: 'Decision', color: '#7c3aed' },
  { type: 'gateway', label: 'Exclusive Gateway', color: 'var(--accent)' },
];

export function blankDraft(productId: string, targetModule: AutoFlowProcess['targetModule'], allowedRoles: AutoFlowProcess['allowedRoles'], name: string): AutoFlowProcess {
  const laneId = newId('autoflowlane');
  const milestoneId = newId('autoflowmilestone');
  return {
    id: newId('autoflow'),
    name,
    productId,
    allowedRoles,
    targetModule,
    status: 'draft',
    lanes: [{ id: laneId, label: 'Lane 1', order: 0 }],
    milestones: [{ id: milestoneId, label: 'Milestone 1', order: 0 }],
    nodes: [
      { id: newId('autoflownode'), type: 'start', position: { x: 40, y: 80 }, laneId, milestoneId, data: { label: 'Start' } },
      { id: newId('autoflownode'), type: 'end', position: { x: 320, y: 80 }, laneId, milestoneId, data: { label: 'End' } },
    ],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function laneBackgroundNodes(lanes: AutoFlowLane[], nodes: AutoFlowNode[]): Node[] {
  return lanes.map((lane) => {
    const members = nodes.filter((n) => n.laneId === lane.id);
    const xs = members.map((n) => n.position.x);
    const ys = members.map((n) => n.position.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 400;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 200;
    return {
      id: `lanebg-${lane.id}`,
      type: 'lane',
      position: { x: minX - LANE_PADDING, y: minY - LANE_PADDING },
      data: { label: lane.label },
      style: { width: maxX - minX + NODE_WIDTH + LANE_PADDING * 2, height: maxY - minY + NODE_HEIGHT + LANE_PADDING * 2 },
      draggable: false,
      selectable: false,
      zIndex: -1,
    };
  });
}

function toFlowNodes(nodes: AutoFlowNode[]): Node[] {
  return nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { ...n.data } }));
}

function toFlowEdges(edges: AutoFlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.branchLabel,
    style: { stroke: 'var(--text-muted)' },
  }));
}

function MilestoneHeaders({ milestones, nodes }: { milestones: AutoFlowMilestone[]; nodes: AutoFlowNode[] }) {
  const { x: panX, zoom } = useViewport();
  const sorted = [...milestones].sort((a, b) => a.order - b.order);
  return (
    <div className="autoflow-milestone-row">
      {sorted.map((milestone) => {
        const members = nodes.filter((n) => n.milestoneId === milestone.id);
        if (members.length === 0) return null;
        const xs = members.map((n) => n.position.x);
        const minX = Math.min(...xs) - LANE_PADDING;
        const maxX = Math.max(...xs) + NODE_WIDTH + LANE_PADDING;
        const left = minX * zoom + panX;
        const width = (maxX - minX) * zoom;
        return (
          <div key={milestone.id} className="autoflow-milestone-header" style={{ left, width }}>
            {milestone.label}
          </div>
        );
      })}
    </div>
  );
}

interface ValidationIssue {
  message: string;
}

function validateProcess(nodes: AutoFlowNode[], edges: AutoFlowEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const startNodes = nodes.filter((n) => n.type === 'start');
  if (startNodes.length !== 1) issues.push({ message: `Exactly one Start node is required (found ${startNodes.length}).` });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, AutoFlowEdge[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e);
  }

  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const stack = [startNodes[0].id];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const e of outgoing.get(id) ?? []) stack.push(e.target);
    }
    for (const n of nodes) {
      if (!reachable.has(n.id)) issues.push({ message: `"${n.data.label}" is not reachable from Start.` });
    }
  }

  for (const n of nodes) {
    if (n.type === 'end') continue;
    const outs = outgoing.get(n.id) ?? [];
    if (outs.length === 0) issues.push({ message: `"${n.data.label}" has no outgoing connection.` });
    if (n.type === 'decision' || n.type === 'gateway') {
      const hasElse = outs.some((e) => !e.condition);
      if (outs.length > 1 && !hasElse) {
        issues.push({ message: `"${n.data.label}" has multiple branches but no condition-less "else" edge.` });
      }
    }
  }

  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) issues.push({ message: 'An edge references a missing node.' });
  }

  return issues;
}

function AutoFlowCanvas({
  process,
  nodes,
  edges,
  setNodes,
  setEdges,
  readOnly,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: {
  process: AutoFlowProcess;
  nodes: AutoFlowNode[];
  edges: AutoFlowEdge[];
  setNodes: (updater: (prev: AutoFlowNode[]) => AutoFlowNode[]) => void;
  setEdges: (updater: (prev: AutoFlowEdge[]) => AutoFlowEdge[]) => void;
  readOnly: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();

  const flowNodes = useMemo(() => {
    const bg = laneBackgroundNodes(process.lanes, nodes);
    const real = toFlowNodes(nodes).map((n) => ({ ...n, selected: n.id === selectedNodeId }));
    return [...bg, ...real];
  }, [process.lanes, nodes, selectedNodeId]);

  const flowEdges = useMemo(
    () => toFlowEdges(edges).map((e) => ({ ...e, selected: e.id === selectedEdgeId })),
    [edges, selectedEdgeId]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      setNodes((prev) => {
        let next = prev;
        for (const change of changes) {
          if (change.type === 'position' && change.position && !change.id.startsWith('lanebg-')) {
            const pos = change.position;
            next = next.map((n) => (n.id === change.id ? { ...n, position: pos } : n));
          } else if (change.type === 'remove' && !change.id.startsWith('lanebg-')) {
            next = next.filter((n) => n.id !== change.id);
          }
        }
        return next;
      });
    },
    [readOnly, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      setEdges((prev) => {
        let next = prev;
        for (const change of changes) {
          if (change.type === 'remove') next = next.filter((e) => e.id !== change.id);
        }
        return next;
      });
    },
    [readOnly, setEdges]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      const edge: AutoFlowEdge = {
        id: newId('autoflowedge'),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      };
      setEdges((prev) => [...prev, edge]);
    },
    [readOnly, setEdges]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const type = e.dataTransfer.getData('application/autoflow-node-type') as AutoFlowNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const firstLane = process.lanes[0];
      const firstMilestone = process.milestones[0];
      const node: AutoFlowNode = {
        id: newId('autoflownode'),
        type,
        position,
        laneId: firstLane?.id ?? '',
        milestoneId: firstMilestone?.id ?? '',
        data: { label: PALETTE.find((p) => p.type === type)?.label ?? type },
      };
      setNodes((prev) => [...prev, node]);
    },
    [readOnly, screenToFlowPosition, process.lanes, process.milestones, setNodes]
  );

  return (
    <div className="autoflow-canvas-wrap" data-testid="autoflow-canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={autoFlowNodeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onNodeClick={(_, node) => !node.id.startsWith('lanebg-') && onSelectNode(node.id)}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onPaneClick={() => {
          onSelectNode(null);
          onSelectEdge(null);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <MilestoneHeaders milestones={process.milestones} nodes={nodes} />
    </div>
  );
}

function NodeInspector({
  node,
  process,
  onChange,
  onDelete,
  readOnly,
}: {
  node: AutoFlowNode;
  process: AutoFlowProcess;
  onChange: (patch: Partial<AutoFlowNode>) => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const allFields = useMemo(() => getAllModuleFields(process.targetModule), [process.targetModule]);
  const conditionFields = useMemo(() => getConditionFields(process.targetModule), [process.targetModule]);
  const included = (node.data.fieldKeys ?? [])
    .map((k) => allFields.find((f) => f.key === k))
    .filter((f): f is ModuleFieldDef => Boolean(f));
  const available = allFields.filter((f) => !(node.data.fieldKeys ?? []).includes(f.key));
  const [dragKey, setDragKey] = useState<string | null>(null);

  const dropOnIncluded = (e: DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/autoflow-field-key') || dragKey;
    if (!key) return;
    const keys = node.data.fieldKeys ?? [];
    if (keys.includes(key)) return;
    onChange({ data: { ...node.data, fieldKeys: [...keys, key] } });
    setDragKey(null);
  };
  const dropOnAvailable = (e: DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/autoflow-field-key') || dragKey;
    if (!key) return;
    onChange({ data: { ...node.data, fieldKeys: (node.data.fieldKeys ?? []).filter((k) => k !== key) } });
    setDragKey(null);
  };

  return (
    <div className="card" data-testid="autoflow-node-inspector">
      <div className="page-header" style={{ border: 'none', marginBottom: 8, paddingBottom: 0 }}>
        <h4 style={{ margin: 0 }}>Node: {node.type}</h4>
        {!readOnly && (
          <button className="btn btn-small btn-danger" onClick={onDelete}>
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
      <div className="field">
        <span className="field-label">Label</span>
        <input
          className="input"
          disabled={readOnly}
          value={node.data.label}
          onChange={(e) => onChange({ data: { ...node.data, label: e.target.value } })}
        />
      </div>
      <div className="field">
        <span className="field-label">Milestone</span>
        <Select
          value={node.milestoneId}
          options={process.milestones.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(v) => onChange({ milestoneId: v })}
          disabled={readOnly}
        />
      </div>
      <div className="field">
        <span className="field-label">Lane</span>
        <Select
          value={node.laneId}
          options={process.lanes.map((l) => ({ value: l.id, label: l.label }))}
          onChange={(v) => onChange({ laneId: v })}
          disabled={readOnly}
        />
      </div>

      {node.type === 'wait' && (
        <div className="field">
          <span className="field-label">Wait minutes</span>
          <input
            className="input"
            type="number"
            disabled={readOnly}
            value={node.data.waitMinutes ?? 0}
            onChange={(e) => onChange({ data: { ...node.data, waitMinutes: Number(e.target.value) } })}
          />
        </div>
      )}

      {node.type === 'decision' && (
        <ConditionEditor
          condition={node.data.condition}
          fields={conditionFields}
          disabled={readOnly}
          onChange={(condition) => onChange({ data: { ...node.data, condition } })}
        />
      )}

      {node.type === 'state' && (
        <>
          <div className="field">
            <span className="field-label">Action on advance</span>
            <Select
              value={node.data.action ?? ''}
              options={[
                { value: '', label: 'None' },
                { value: 'dedupe', label: 'De-dupe check' },
                { value: 'assign', label: 'Assignment rule' },
              ]}
              onChange={(v) => onChange({ data: { ...node.data, action: (v || null) as 'dedupe' | 'assign' | null } })}
              disabled={readOnly}
            />
          </div>
          <h5 style={{ marginBottom: 4 }}>Fields shown on this step</h5>
          <div className="dnd-columns">
            <div className="card">
              <h4>Available</h4>
              <ul className="dnd-list" onDragOver={(e) => e.preventDefault()} onDrop={dropOnAvailable}>
                {available.map((f) => (
                  <li
                    key={f.key}
                    className="dnd-item"
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/autoflow-field-key', f.key);
                      setDragKey(f.key);
                    }}
                  >
                    ⠿ {f.label}
                  </li>
                ))}
                {available.length === 0 && <li className="muted">All fields placed.</li>}
              </ul>
            </div>
            <div className="card">
              <h4>Included</h4>
              <ul className="dnd-list" onDragOver={(e) => e.preventDefault()} onDrop={dropOnIncluded}>
                {included.map((f) => (
                  <li
                    key={f.key}
                    className="dnd-item"
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/autoflow-field-key', f.key);
                      setDragKey(f.key);
                    }}
                  >
                    ⠿ {f.label}
                  </li>
                ))}
                {included.length === 0 && <li className="muted">Drag fields here.</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ConditionEditor({
  condition,
  fields,
  disabled,
  onChange,
}: {
  condition?: AutoFlowCondition;
  fields: ModuleFieldDef[];
  disabled: boolean;
  onChange: (condition: AutoFlowCondition | undefined) => void;
}) {
  return (
    <div className="card form-card" style={{ padding: 10 }}>
      <div className="field">
        <span className="field-label">Condition field</span>
        <Select
          value={condition?.field ?? ''}
          options={[{ value: '', label: 'None (else branch)' }, ...fields.map((f) => ({ value: f.key, label: f.label }))]}
          onChange={(v) =>
            onChange(v ? { field: v, operator: condition?.operator ?? 'equals', value: condition?.value ?? '' } : undefined)
          }
          disabled={disabled}
        />
      </div>
      {condition && (
        <>
          <div className="field">
            <span className="field-label">Operator</span>
            <Select
              value={condition.operator}
              options={[
                { value: 'equals', label: 'equals' },
                { value: 'contains', label: 'contains' },
              ]}
              onChange={(v) => onChange({ ...condition, operator: v as 'equals' | 'contains' })}
              disabled={disabled}
            />
          </div>
          <div className="field">
            <span className="field-label">Value</span>
            <input
              className="input"
              disabled={disabled}
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function EdgeInspector({
  edge,
  process,
  onChange,
  onDelete,
  readOnly,
}: {
  edge: AutoFlowEdge;
  process: AutoFlowProcess;
  onChange: (patch: Partial<AutoFlowEdge>) => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const allFields = useMemo(() => getConditionFields(process.targetModule), [process.targetModule]);
  return (
    <div className="card" data-testid="autoflow-edge-inspector">
      <div className="page-header" style={{ border: 'none', marginBottom: 8, paddingBottom: 0 }}>
        <h4 style={{ margin: 0 }}>Connection</h4>
        {!readOnly && (
          <button className="btn btn-small btn-danger" onClick={onDelete}>
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
      <div className="field">
        <span className="field-label">Branch label</span>
        <input
          className="input"
          disabled={readOnly}
          value={edge.branchLabel ?? ''}
          onChange={(e) => onChange({ branchLabel: e.target.value })}
        />
      </div>
      <ConditionEditor condition={edge.condition} fields={allFields} disabled={readOnly} onChange={(condition) => onChange({ condition })} />
    </div>
  );
}

export function AutoFlowDesigner() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const isNew = id === 'draft';
  const draftFromState = (location.state as { draft?: AutoFlowProcess } | null)?.draft;

  const [process, setProcess] = useState<AutoFlowProcess | null>(
    isNew ? draftFromState ?? blankDraft('', 'leads', ['admin', 'rep'], 'New Process') : null
  );
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [nodes, setNodes] = useState<AutoFlowNode[]>(process?.nodes ?? []);
  const [edges, setEdges] = useState<AutoFlowEdge[]>(process?.edges ?? []);
  const [lanes, setLanes] = useState<AutoFlowLane[]>(process?.lanes ?? []);
  const [milestones, setMilestones] = useState<AutoFlowMilestone[]>(process?.milestones ?? []);
  const [name, setName] = useState(process?.name ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationIssue[] | null>(null);

  const readOnly = !isNew && user?.role !== 'admin';

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const p = await getById<AutoFlowProcess>('autoFlowProcesses', id ?? '');
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProcess(p);
      setNodes(p.nodes);
      setEdges(p.edges);
      setLanes(p.lanes);
      setMilestones(p.milestones);
      setName(p.name);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <div className="empty-cell">
        AutoFlow process not found. <Link to="/setup/autoflow">Back to AutoFlow</Link>
      </div>
    );
  }
  if (loading || !process) return <Spinner label="Loading process…" />;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const updateNode = (patch: Partial<AutoFlowNode>) => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedNodeId ? { ...n, ...patch } : n)));
  };
  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };
  const updateEdge = (patch: Partial<AutoFlowEdge>) => {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)));
  };
  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const addLane = () => {
    const label = window.prompt('New lane name?');
    if (!label?.trim()) return;
    setLanes((prev) => [...prev, { id: newId('autoflowlane'), label: label.trim(), order: prev.length }]);
  };
  const addMilestone = () => {
    const label = window.prompt('New milestone name?');
    if (!label?.trim()) return;
    setMilestones((prev) => [...prev, { id: newId('autoflowmilestone'), label: label.trim(), order: prev.length }]);
  };

  const runValidate = () => setValidation(validateProcess(nodes, edges));

  const save = async () => {
    if (!name.trim()) {
      toast.push('error', 'Name is required.');
      return;
    }
    setBusy(true);
    const toSave: AutoFlowProcess = { ...process, name: name.trim(), nodes, edges, lanes, milestones, updatedAt: new Date().toISOString() };
    const saved = await upsert('autoFlowProcesses', toSave);
    setProcess(saved);
    setBusy(false);
    toast.push('success', `AutoFlow process "${saved.name}" saved.`);
    if (isNew) navigate(`/setup/autoflow/${saved.id}`);
  };

  const clone = async () => {
    const cloned: AutoFlowProcess = {
      ...process,
      id: newId('autoflow'),
      name: `${name.trim() || process.name} (Copy)`,
      status: 'draft',
      nodes,
      edges,
      lanes,
      milestones,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await upsert('autoFlowProcesses', cloned);
    toast.push('success', `Cloned as "${saved.name}".`);
    navigate(`/setup/autoflow/${saved.id}`);
  };

  return (
    <div data-testid="autoflow-designer-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <Link to="/setup/autoflow">AutoFlow</Link> <span>/</span>{' '}
        <span>{name || 'New process'}</span>
      </nav>
      <div className="page-header">
        <input
          className="input"
          style={{ fontSize: 'var(--font-xl)', fontWeight: 700, maxWidth: 420 }}
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          data-testid="autoflow-name-input"
        />
        <div className="page-actions">
          <button className="btn" onClick={() => navigate('/setup/autoflow')}>
            Cancel
          </button>
          {!isNew && (
            <button className="btn" onClick={clone}>
              Clone
            </button>
          )}
          {!readOnly && (
            <button className="btn" onClick={addLane}>
              + Pool
            </button>
          )}
          {!readOnly && (
            <button className="btn" onClick={addMilestone}>
              + Milestone
            </button>
          )}
          <button className="btn" onClick={runValidate}>
            Validate
          </button>
          {!readOnly && (
            <button className="btn btn-primary" disabled={busy} onClick={save} data-testid="save-autoflow-btn">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
      {readOnly && (
        <div className="banner banner-info" data-testid="autoflow-readonly-banner">
          You have read-only access to this AutoFlow process. Contact an administrator to make changes.
        </div>
      )}

      <div className="autoflow-layout">
        {!readOnly && (
          <div className="card autoflow-palette-card">
            <h4>Palette</h4>
            <div className="autoflow-palette">
              {PALETTE.map((item) => (
                <div
                  key={item.type}
                  className="autoflow-palette-item"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/autoflow-node-type', item.type)}
                >
                  <span className="autoflow-palette-swatch" style={{ background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}

        <ReactFlowProvider>
          <AutoFlowCanvas
            process={{ ...process, lanes, milestones }}
            nodes={nodes}
            edges={edges}
            setNodes={setNodes}
            setEdges={setEdges}
            readOnly={readOnly}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={(nid) => {
              setSelectedNodeId(nid);
              setSelectedEdgeId(null);
            }}
            onSelectEdge={(eid) => {
              setSelectedEdgeId(eid);
              setSelectedNodeId(null);
            }}
          />
        </ReactFlowProvider>

        <div className="autoflow-inspector-col">
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              process={{ ...process, lanes, milestones }}
              onChange={updateNode}
              onDelete={deleteSelectedNode}
              readOnly={readOnly}
            />
          )}
          {selectedEdge && (
            <EdgeInspector edge={selectedEdge} process={process} onChange={updateEdge} onDelete={deleteSelectedEdge} readOnly={readOnly} />
          )}
          {!selectedNode && !selectedEdge && <p className="muted">Select a node or connection to edit it.</p>}
        </div>
      </div>

      {validation && (
        <Modal
          title="Validate process"
          onClose={() => setValidation(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setValidation(null)}>
              Close
            </button>
          }
        >
          {validation.length === 0 ? (
            <p>No issues found — this process is well-formed.</p>
          ) : (
            <ul className="related-list">
              {validation.map((issue, i) => (
                <li key={i} className={classNames('field-error')}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
