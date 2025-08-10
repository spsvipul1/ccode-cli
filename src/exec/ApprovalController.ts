export type ApprovalProposal = {
  id: string
  name: string
  args: unknown
}

export class ApprovalController {
  private pending = new Map<string, { proposal: ApprovalProposal; resolve: (v: boolean) => void; approved: boolean }>();
  private autoApprove: boolean;

  constructor(options?: { autoApprove?: boolean }) {
    this.autoApprove = !!options?.autoApprove;
  }

  shouldRequireApproval(toolName: string): boolean {
    return /^(edit|multiedit|fs\.write|notebook\.edit)$/i.test(toolName);
  }

  async requestApproval(proposal: ApprovalProposal): Promise<boolean> {
    if (this.autoApprove) return true;
    if (!this.pending.has(proposal.id)) {
      let resolve!: (v: boolean) => void;
      const p = new Promise<boolean>((r) => (resolve = r));
      this.pending.set(proposal.id, { proposal, resolve, approved: false });
    }
    return false;
  }

  async waitForApproval(id: string, timeoutMs = 300000): Promise<boolean> {
    const entry = this.pending.get(id);
    if (!entry) return this.autoApprove;
    if (entry.approved) return true;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      entry.resolve = (v: boolean) => { clearTimeout(timer); resolve(v); };
    });
  }

  approve(id: string) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    entry.approved = true;
    entry.resolve(true);
    this.pending.delete(id);
    return true;
  }

  approveAll() {
    for (const id of Array.from(this.pending.keys())) this.approve(id);
  }

  listPending(): ApprovalProposal[] {
    return Array.from(this.pending.values()).map((v) => v.proposal);
  }
}

