import type { Persona } from "./types";

// The demo principals seeded in agentctl.principal. Switching persona is the single
// most convincing thing in the demo: the same question, refused or scoped differently,
// with the database — not the UI — deciding.
export const PERSONAS: Persona[] = [
  { subject: "demo.owner",     label: "Group Owner",          role: "super_admin",
    initials: "GO", blurb: "Every branch, every module. Aggregate and patient-level." },
  { subject: "demo.manager",   label: "Branch Manager · AUH01", role: "branch_manager", branch: "AUH01",
    initials: "BM", blurb: "Own branch only — enforced by row-level security, not by the prompt." },
  { subject: "demo.billing",   label: "Billing Lead",         role: "billing_accounts",
    initials: "BL", blurb: "Collections, receivables, VAT, ledger." },
  { subject: "demo.claims",    label: "Claims Coordinator",   role: "claims_coordinator",
    initials: "CC", blurb: "e-Claims, denials, prior auth, remittances." },
  { subject: "demo.coder",     label: "Medical Coder",        role: "coder",
    initials: "MC", blurb: "Coder queries, coding audits, scrubber findings." },
  { subject: "demo.clinical",  label: "Treating Clinician",   role: "clinical",
    initials: "DR", blurb: "Clinical record, one patient at a time." },
  { subject: "demo.frontdesk", label: "Front Desk · DXB01",   role: "front_desk", branch: "DXB01",
    initials: "FD", blurb: "Registration and scheduling. No revenue, no commission." },
  { subject: "demo.auditor",   label: "Compliance Auditor",   role: "auditor",
    initials: "CA", blurb: "HIE, TATMEEN, break-glass access, audit trail." },
];

export const DEFAULT_PERSONA = PERSONAS[0];

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", branch_manager: "Branch Manager", front_desk: "Front Desk",
  billing_accounts: "Billing / Accounts", clinical: "Clinical", claims_coordinator: "Claims",
  coder: "Medical Coder", auditor: "Auditor", marketing: "Marketing", storekeeper: "Storekeeper",
};
