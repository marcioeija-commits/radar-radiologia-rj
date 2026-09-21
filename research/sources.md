# Fontes verificadas para o Radar Radiologia RJ

Pesquisa realizada em 2026-09-19.

## Fontes prioritárias

### Diário Oficial do Estado do Rio de Janeiro (IOERJ)
- https://portal.ioerj.com.br/
- https://portal.ioerj.com.br/diario-oficial/
- https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php
- https://www.ioerj.com.br/portal/modules/conteudoonline/do_ultima_edicao.php
- https://www.ioerj.com.br/portal/modules/conteudoonline/do_seleciona_data.php
- A pesquisa oficial cobre publicações e edições do Diário Oficial, sem API pública/documentada ou feed específico do DOERJ confirmado.
- Priorizar Parte I (Poder Executivo) e pesquisar variações com/sem acento de Técnico em Radiologia, Tecnólogo em Radiologia, radiodiagnóstico, diagnóstico por imagem e imagenologia.

### Prefeitura do Rio, SMS-Rio e RioSaúde
- https://saude.prefeitura.rio/gestao-de-pessoas/
- https://prefeitura.rio/rio-saude/processo-seletivo/
- https://riosaude.prefeitura.rio/processos-seletivos/
- https://riosaude.prefeitura.rio/processos-seletivos-editais-abertos/
- https://riosaude.prefeitura.rio/concursos-publicos-2/
- https://www.rio.rj.gov.br/web/portaldeconcursos/concursos
- https://www.rio.rj.gov.br/web/portaldeconcursos/processos-seletivos
- https://www.rio.rj.gov.br/web/portaldeconcursos/listas
- https://doweb.rio.rj.gov.br/
- A URL antiga `https://riosaude.prefeitura.rio/processos-seletivos-editais-abertos-2025/` retornou 404; as páginas sem o sufixo 2025 são as atuais.
- Existem históricos de Técnico de Radiologia na RioSaúde e oportunidades/estágios de radiologia; é necessário distinguir cargo, estágio, convocação e publicação expirada.

### Fundação Saúde do Estado do Rio de Janeiro
- http://www.fs.rj.gov.br/concursos/
- https://www.fs.rj.gov.br/
- https://www.fs.rj.gov.br/institucional/
- A página oficial de concursos lista concursos e convocações; RSS/API não foram confirmados.
- O acesso automatizado ao domínio apresentou falhas intermitentes; usar retries e fallback.
- PDFs de ETP/TR que mencionam radiologia não devem ser convertidos em vagas sem edital/processo seletivo.

### SES-RJ
- https://www.saude.rj.gov.br/recursos-humanos
- https://www.saude.rj.gov.br/organizacoes-sociais-de-saude/editais-de-selecao
- https://www.saude.rj.gov.br/noticias
- A área oficial tem editais, notícias e PDFs, mas não um banco geral de vagas; monitorar HTML/PDF e separar seleções de OSS.

### PCI Concursos (auxiliar, não fonte oficial)
- https://www.pciconcursos.com.br/concursos/rj/
- https://www.pciconcursos.com.br/vagas/tecnico-em-radiologia
- https://www.pciconcursos.com.br/vagas/tecnologo-em-radiologia
- https://www.pciconcursos.com.br/robots.txt
- Usar somente para descoberta e confirmar no órgão oficial/Diário Oficial. Mistura estados, históricos e registros expirados.

## Estratégia técnica

Não foi confirmado webhook, RSS específico ou API pública para as fontes prioritárias. O monitoramento deve usar polling periódico de HTML e PDFs, com rate limiting, retries, deduplicação por URL/hash, classificação de edital/resultado/convocação/estágio/vaga e validação cruzada no órgão oficial. A rotina implementada inicia por três fontes no catálogo: IOERJ, Prefeitura/SMS-Rio/RioSaúde e Fundação Saúde.
