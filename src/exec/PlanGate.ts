export class PlanGate {
  private approved = false;
  approvePlan(): void { this.approved = true; }
  isApproved(): boolean { return this.approved; }
}

