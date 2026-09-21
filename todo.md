# Radar Radiologia RJ — Próxima etapa

## Concluído

- Pesquisa de fontes do RJ: IOERJ/DOERJ, Prefeitura/SMS-Rio/RioSaúde, Fundação Saúde, SES-RJ e PCI Concursos.
- Catálogo inicial de fontes oficiais no banco.
- Tabelas de oportunidades, fontes, preferências, dispositivos push e execuções de monitoramento.
- Coletor HTML com variações de cargo, classificação de Técnico/Tecnólogo, deduplicação por fonte e identificador e filtro de documentos técnicos que não são vagas.
- Endpoint protegido `/api/scheduled/monitor-radiologia` para execução automática.
- Endpoint manual `monitoring.runNow` para teste autenticado.
- Tela Radar ligada ao backend quando há usuário autenticado.
- Filtros de Ajustes sincronizados com a conta.
- Registro de token Expo quando o app nativo tiver um projectId configurado.
- Testes automatizados: 9 aprovados e 1 teste legado ignorado.
- Coleta real única validada: 3 fontes cadastradas, 8 páginas acessadas, 1 oportunidade nova identificada e nenhum alerta enviado porque ainda não há dispositivos push registrados.

## Pendências de ativação

- Publicar/deployar o projeto para que a URL de produção possa receber a rotina periódica.
- Criar o Heartbeat de produção para chamar o endpoint a cada 60 minutos ou no intervalo escolhido.
- Configurar projectId/EAS e gerar builds nativas para iPhone e Android.
- Entrar na mesma conta nos dois aparelhos e registrar os tokens push.
- Adicionar extração mais profunda de PDFs e paginação/JavaScript quando as fontes exigirem.
- Validar cada oportunidade contra o órgão oficial antes de classificá-la como alerta de vaga aberta.

## Bugs e limitações conhecidas

- A Fundação Saúde apresentou falhas intermitentes de acesso HTTP/HTTPS durante a coleta; o monitor registra a falha e continua nas demais fontes.
- A RioSaúde tinha uma URL antiga que retornava 404; o catálogo foi atualizado para as páginas atuais sem o sufixo `-2025`.
- Nenhuma fonte confirmou API, webhook ou RSS específico; o monitor usa polling de HTML/PDF.
- O preview web não é suficiente para validar push nativo real.
