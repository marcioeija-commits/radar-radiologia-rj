export type Role = "Técnico" | "Tecnólogo";
export type OpportunityKind = "Concurso" | "Processo seletivo" | "Vaga";
export type RoleFilter = "Todos" | Role;

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  city: string;
  role: Role;
  kind: OpportunityKind;
  published: string;
  deadline: string;
  source: string;
  sourceUrl?: string;
  featured?: boolean;
};

export type MonitoringSource = {
  id: string;
  name: string;
  category: "Oficial" | "Concursos" | "Empregadores";
  cadence: string;
  status: "prioritária" | "planejada";
};

export type AlertPreferences = {
  concursos: boolean;
  processos: boolean;
  vagas: boolean;
  tecnico: boolean;
  tecnologo: boolean;
  todoEstado: boolean;
};

export const ROLE_FILTERS: readonly RoleFilter[] = ["Todos", "Técnico", "Tecnólogo"];

export const MONITORING_SOURCES: readonly MonitoringSource[] = [
  { id: "diarios-oficiais", name: "Diários oficiais", category: "Oficial", cadence: "diária", status: "prioritária" },
  { id: "portais-concursos", name: "Portais de concursos", category: "Concursos", cadence: "diária", status: "prioritária" },
  { id: "empregadores-saude", name: "Empregadores da saúde", category: "Empregadores", cadence: "diária", status: "planejada" },
];

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  concursos: true,
  processos: true,
  vagas: true,
  tecnico: true,
  tecnologo: true,
  todoEstado: true,
} as const;

export function filterOpportunities(items: readonly Opportunity[], filter: RoleFilter): Opportunity[] {
  if (filter === "Todos") return [...items];
  return items.filter((item) => item.role === filter);
}

export function matchesAlertPreferences(item: Opportunity, preferences: AlertPreferences): boolean {
  const kindEnabled = item.kind === "Concurso" ? preferences.concursos : item.kind === "Processo seletivo" ? preferences.processos : preferences.vagas;
  const roleEnabled = item.role === "Técnico" ? preferences.tecnico : preferences.tecnologo;
  return kindEnabled && roleEnabled && preferences.todoEstado;
}
