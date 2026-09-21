import { describe, expect, it } from "vitest";

import { extractCandidates, inferKind, inferRole, looksLikeOpportunity } from "../server/monitoring";

describe("coletor de oportunidades", () => {
  it("identifica Técnico em Radiologia como oportunidade", () => {
    expect(looksLikeOpportunity("Edital de concurso para Técnico em Radiologia no RJ")).toBe(true);
    expect(inferRole("Edital de concurso para Técnico em Radiologia")).toBe("Técnico");
    expect(inferKind("Edital de concurso para Técnico em Radiologia")).toBe("Concurso");
  });

  it("identifica Tecnólogo em Radiologia em processo seletivo", () => {
    expect(inferRole("Processo seletivo para Tecnólogo em Radiologia")).toBe("Tecnólogo");
    expect(inferKind("Processo seletivo para Tecnólogo em Radiologia")).toBe("Processo seletivo");
  });

  it("ignora documento técnico sem anúncio de oportunidade", () => {
    expect(looksLikeOpportunity("Termo de referência para contratação de serviço de radiologia")).toBe(false);
  });

  it("extrai links compatíveis e transforma a data publicada", () => {
    const html = `<html><body><a href="/edital-123.pdf">Edital 123: Concurso Técnico em Radiologia — 12/09/2026</a></body></html>`;
    const candidates = extractCandidates(html, "https://example.org/concursos", "Fonte oficial RJ");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceUrl).toBe("https://example.org/edital-123.pdf");
    expect(candidates[0].role).toBe("Técnico");
    expect(candidates[0].publishedAt?.getFullYear()).toBe(2026);
  });
});
