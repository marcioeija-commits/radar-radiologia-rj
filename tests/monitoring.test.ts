import { describe, expect, it } from "vitest";

import {
  DEFAULT_ALERT_PREFERENCES,
  filterOpportunities,
  matchesAlertPreferences,
  type Opportunity,
} from "../shared/monitoring";

const items: Opportunity[] = [
  {
    id: "1",
    title: "Técnico em Radiologia",
    organization: "Hospital público",
    city: "Niterói",
    role: "Técnico",
    kind: "Concurso",
    published: "Hoje",
    deadline: "Aberto",
    source: "Diário oficial",
  },
  {
    id: "2",
    title: "Tecnólogo em Radiologia",
    organization: "Clínica",
    city: "Rio de Janeiro",
    role: "Tecnólogo",
    kind: "Vaga",
    published: "Hoje",
    deadline: "Aberto",
    source: "Empregador",
  },
];

describe("monitoramento do Radar Radiologia RJ", () => {
  it("retorna todas as oportunidades no filtro Todos", () => {
    expect(filterOpportunities(items, "Todos")).toHaveLength(2);
  });

  it("filtra oportunidades pelo cargo selecionado", () => {
    expect(filterOpportunities(items, "Tecnólogo").map((item) => item.id)).toEqual(["2"]);
  });

  it("aceita um item quando o tipo e o cargo estão habilitados", () => {
    expect(matchesAlertPreferences(items[0], DEFAULT_ALERT_PREFERENCES)).toBe(true);
  });

  it("não alerta vagas quando a categoria correspondente está desligada", () => {
    expect(matchesAlertPreferences(items[1], { ...DEFAULT_ALERT_PREFERENCES, vagas: false })).toBe(false);
  });

  it("não alerta oportunidades fora da região configurada", () => {
    expect(matchesAlertPreferences(items[0], { ...DEFAULT_ALERT_PREFERENCES, todoEstado: false })).toBe(false);
  });
});
