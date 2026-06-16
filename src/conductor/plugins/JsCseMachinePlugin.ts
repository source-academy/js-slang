import type { IChannel, IConduit, IPlugin } from '@sourceacademy/conductor/conduit';

// Matches CseMachineHostPlugin.ts on the frontend (feature/cse-machine-base branch).
export type CseSerializedValue = {
  displayValue: string;
  label: string;
  tag?: string;
  metadata?: unknown;
};

export type CseSerializedInstruction = {
  displayText: string;
  tag?: string;
  metadata?: unknown;
};

export type CseSerializedBinding = {
  name: string;
  value: CseSerializedValue;
  isConst?: boolean;
};

export type CseSerializedEnvFrame = {
  id: string;
  name: string;
  parentId: string | null;
  closureFrameId?: string;
  bindings: CseSerializedBinding[];
  /** Closures/arrays in the frame's heap that are NOT bound to any name (anonymous heap objects). */
  heapObjects?: CseSerializedValue[];
  isActive: boolean;
  isOnCallStack?: boolean;
};

export type CseSnapshot = {
  stepIndex: number;
  control: CseSerializedInstruction[];
  stash: CseSerializedValue[];
  environments: CseSerializedEnvFrame[];
  /** 1-based line of the node most recently evaluated (context.runtime.nodes[0]). */
  currentLine?: number;
};

const CSE_CHANNEL = '__cse';

export class JsCseMachinePlugin implements IPlugin {
  readonly name = '__cse_runner';

  private readonly __cseChannel: IChannel<any>;

  sendSnapshots(snapshots: CseSnapshot[]): void {
    this.__cseChannel.send({
      type: 'snapshots',
      snapshots,
      totalSteps: snapshots.length,
    });
  }

  static readonly channelAttach = [CSE_CHANNEL];
  constructor(_conduit: IConduit, [cseChannel]: IChannel<any>[]) {
    this.__cseChannel = cseChannel;
  }
}
