# Roadmap de diferenciação — ConfigSync

Atualizado em **21 de setembro de 2026**. Este documento define o produto que vamos construir para
o ConfigSync deixar de ser apenas “cloud backup de configs” e tornar-se o lugar onde settings são
descobertos, comparados, adaptados, aplicados com segurança e mantidos atualizados.

É um plano de produto, não uma descrição do que já está live. Cada funcionalidade proposta só pode
aparecer na interface quando os dados e o comportamento correspondente existirem.

## A decisão de produto

O mercado já tem:

- launchers que sincronizam alguns ficheiros;
- ferramentas de backup genérico;
- aplicações que guardam configs na cloud;
- vários sites com tabelas de settings de jogadores profissionais.

Não vamos tentar ganhar apenas com “guardamos o ficheiro” nem construir outra base de dados estática
de sensibilidades. Vamos ligar cinco capacidades num único ciclo:

```text
descobrir uma config real
          ↓
comparar com a minha
          ↓
escolher as diferenças que quero
          ↓
guardar como fork com origem e versão
          ↓
aplicar com backup, validação e rollback
          ↓
receber updates e voltar a comparar
          ↓
partilhar com amigos, seguidores ou equipa
```

Esta ligação é a diferença. Um site de pro settings normalmente termina no download. Uma ferramenta
de backup normalmente começa e termina no ficheiro. O ConfigSync deve manter a origem, explicar a
diferença, permitir adaptar e provar o que foi aplicado.

### Promessa central

> **Find a setup you trust. Compare it with yours. Apply only what you want, safely.**

### Quatro provas que sustentam a promessa

1. **Origem:** quem publicou, qual a versão e quando foi verificada.
2. **Diferença:** o que muda, por setting, antes de guardar ou aplicar.
3. **Segurança:** jogo fechado, backup, escrita transacional, validação e rollback.
4. **Continuidade:** o fork mantém ligação à origem e pode receber updates seletivos.

---

## 1. O que já existe e deve ser aproveitado

O produto não começa do zero:

- perfis públicos e presets públicos;
- cópia de um preset público para o vault;
- comparação tipada entre dois presets;
- snapshots por preset;
- companion Windows e Linux;
- `--dry-run`;
- backup `.bak-*` antes de cada escrita;
- deteção de jogo aberto no modo `watch`;
- heartbeat de dispositivos;
- preset Default e preset diferente por PC;
- auto-switch;
- catálogo com mapeamento entre settings e ficheiros reais;
- estado aplicado por dispositivo;
- import/export e revisão de conflitos.

As novas funcionalidades devem estender estes conceitos. Não criar uma segunda forma de preset,
uma segunda página de perfil ou outro formato de comparação.

### Falha de segurança encontrada e prioridade imediata

O `watch` verifica processos antes de aplicar, mas o comando manual `csync apply` chama a escrita
sem fazer a mesma verificação no ponto final. A proteção está no fluxo, não na função que escreve.
Qualquer caminho novo pode repetir o erro.

**Correção P0:** toda a escrita deve passar por uma única função que verifica novamente se o jogo
está fechado imediatamente antes de tocar nos ficheiros. `apply`, `watch`, `launch`, tray app e
futuros fluxos usam essa função. Se não for possível determinar o estado, a ação falha de forma
segura e não escreve.

---

## 2. Os cinco pilares

### 2.1 Amigos, seguidores e atividade real

“Amigos” e “seguir” resolvem relações diferentes:

- **Friend:** relação mútua entre jogadores; permite partilha `friends-only` e presença opcional.
- **Follow:** relação unilateral com um perfil público, creator ou pro; serve para acompanhar
  presets e updates sem exigir amizade.

### MVP de amigos

- enviar, aceitar, ignorar e cancelar pedido;
- remover amigo;
- bloquear utilizador;
- encontrar por username ou link de convite;
- não procurar por email por defeito;
- lista de amigos com último evento partilhado;
- partilhar preset apenas com amigos;
- feed cronológico pequeno de eventos reais;
- configurações de privacidade por tipo de evento.

### Presença honesta

O companion já envia heartbeat. Podemos derivar presença sem inventar:

- `Online`: heartbeat recente, por exemplo nos últimos 90 segundos;
- `Away`: heartbeat recente mas sem interação conhecida;
- `Offline`: heartbeat expirado;
- `Playing <game>`: apenas quando o companion reportar explicitamente um processo de um jogo do
  catálogo e o utilizador tiver ativado esta partilha;
- `Invisible`: opção permanente.

Defaults:

- presença desligada;
- quando ativada, visível apenas a amigos;
- nunca mostrar hostname, nome do dispositivo, caminho local ou preset privado;
- apagar eventos efémeros de presença em vez de criar histórico de atividade pessoal.

### Feed útil

Eventos permitidos:

- publicou um preset;
- publicou uma nova versão de um preset seguido;
- adicionou suporte público a um jogo;
- tornou público um setup verificado;
- partilhou uma comparação explicitamente.

Eventos que não entram no feed:

- login;
- alteração privada;
- aplicação num dispositivo;
- hostname, estado de ficheiros ou falhas do companion;
- cada pequeno save de um preset.

O feed não terá algoritmo no início. Ordem cronológica, máximo de eventos por autor e opção de
silenciar. Sem conteúdo patrocinado disfarçado.

### Não construir nesta fase

- chat e mensagens diretas;
- comentários abertos;
- contadores de likes;
- streaks;
- “pessoas que talvez conheças” baseado em contactos;
- ranking de popularidade sem proteção contra manipulação.

Chat e comentários trazem spam, moderação e segurança para menores sem melhorarem o loop principal.
Uma cópia, um fork ou um follow são sinais mais úteis que um like.

---

### 2.2 Configs de pros e creators — verificadas e vivas

Existem muitos diretórios de pro settings. Alguns mostram centenas de jogadores, hardware e valores
“verificados”. Uma tabela menor não diferencia o ConfigSync. A oportunidade é fazer uma config
aplicável, versionada e atualizável.

### Dois tipos de verificação separados

1. **Identity verified:** confirmámos que o perfil pertence ao jogador, creator, coach ou equipa.
2. **Setup verified:** aquela revisão concreta foi confirmada pelo companion ou diretamente pelo
   dono numa data específica.

Nunca usar apenas um check azul ambíguo. A interface mostra:

- identidade verificada por quem;
- versão/revisão do preset;
- “Applied with ConfigSync” quando existir um recibo válido;
- data da última verificação;
- jogo e versão do catálogo;
- origem: owner-published, team-published ou community-sourced;
- campos incompletos claramente marcados.

### Processo de entrada de um pro/creator

1. convite ou pedido de claim;
2. prova de controlo através de conta social/site/email de equipa;
3. consentimento para publicar nome, equipa, links e config;
4. criação/importação pelo próprio ou sessão assistida;
5. aplicação através do companion para gerar prova da revisão;
6. revisão manual do perfil;
7. publicação com data e origem;
8. revalidação periódica ou quando o jogo/catalog muda.

Não copiar configs de outros sites e apresentá-las como verificadas. Podemos criar perfis
`community-sourced`, com fonte e data, mas sem usar fotografia, marca ou endorsement não autorizado.

### Página de setup profissional

- identidade, equipa/role e links autorizados;
- settings por categoria;
- contexto do setup: DPI, resolução, refresh rate, aspect ratio e plataforma quando fornecidos;
- versão e data de verificação;
- botão `Compare with mine`;
- botão `Save as my fork`;
- botão `Apply selected changes`;
- changelog entre versões;
- aviso de que settings pessoais não garantem performance;
- fonte de cada dado quando não foi publicado pelo próprio.

### Update de uma config seguida

Quando o pro publica uma nova revisão:

1. o follower recebe um evento, não uma alteração automática;
2. abre um diff entre a versão de origem copiada e a nova;
3. vê também o que alterou no próprio fork;
4. escolhe setting a setting;
5. cria uma nova revisão no seu fork;
6. aplica apenas depois de dry-run e confirmação.

Nunca substituir silenciosamente um preset pessoal porque a origem mudou.

### Programa inicial

Começar com **10 perfis reclamados**, não 500 perfis copiados:

- 3 creators de CS2;
- 3 creators de Rocket League;
- 2 coaches;
- 2 jogadores competitivos ou equipas pequenas.

Objetivo: provar claim, versão, diff, fork, update e apply. Só depois criar diretório público amplo.

---

### 2.3 Partilha com origem, versão e controlo

Hoje copiar um preset cria uma cópia independente. O próximo passo é preservar a história.

### Config Lineage

Cada preset copiado passa a guardar:

- preset de origem;
- revisão de origem;
- autor de origem;
- data da cópia;
- hash do conteúdo copiado;
- última revisão da origem já analisada;
- estado da ligação: following, muted ou detached.

O dono da origem não controla o fork. Se apagar ou privatizar a origem, o fork continua a pertencer
a quem o copiou, mas deixa de receber conteúdo futuro. Dados privados nunca são copiados.

### Links de partilha

Quatro modos:

- **Private:** apenas o dono.
- **Friends:** amigos aceites.
- **Unlisted:** qualquer pessoa com token difícil de adivinhar; não indexado.
- **Public:** perfil público e indexável.

Dois tipos de link:

- **Live:** mostra sempre a revisão pública atual.
- **Pinned snapshot:** aponta para uma revisão imutável; ideal para torneios, vídeos e guias.

Controlos:

- revogar link;
- gerar novo token;
- definir expiração em links unlisted;
- impedir download e permitir apenas preview não oferece segurança real, portanto não prometer;
- notas privadas removidas no servidor, como já acontece hoje;
- mostrar conteúdo e metadados exatos antes de publicar.

### Share card

Cada preset público gera uma imagem OG com dados reais:

- jogo;
- autor;
- nome do preset;
- revisão/data;
- 3–5 settings principais definidos por catálogo;
- estado de verificação;
- domínio ConfigSync.

Sem avatares falsos, contadores falsos ou frases automáticas do género “best config”.

### Setup bundles

Um bundle é uma coleção partilhável de presets, por exemplo:

- `My tournament setup`;
- `Desktop + laptop`;
- `CS2 + Rocket League`;
- setup completo de um creator.

Um bundle guarda referências a revisões específicas. Quem o copia escolhe tudo ou presets
individuais. Não duplica settings num novo formato.

### Links para LAN

Gerar QR code para um pinned snapshot ou bundle. A utilização normal continua a exigir conta antes
de gravar no vault. O modo temporário de LAN aparece numa fase posterior, com sessão de curta
duração e limpeza de credenciais.

### Métricas para o autor

Fornecer apenas métricas first-party agregadas:

- visualizações únicas aproximadas;
- saves/forks;
- comparação iniciada;
- aplicações confirmadas;
- origem do link/campanha quando existe UTM.

Não expor quem viu. Mostrar identidade apenas quando a pessoa fez uma ação social explícita.

---

### 2.4 Safe Apply v2 — segurança como produto

Esta é a diferenciação mais defensável porque exige integração real com os jogos e cria confiança.
Todas as proteções básicas são Free. Nunca cobrar para evitar perda de ficheiros.

### Pipeline transacional

Para uma aplicação com vários ficheiros:

1. resolver apenas paths permitidos pelo catálogo local;
2. confirmar que cada path está dentro das raízes esperadas;
3. identificar processos do jogo;
4. abortar se o jogo estiver aberto ou se a deteção for inconclusiva;
5. ler bytes, permissões, timestamp e hash de todos os ficheiros;
6. pedir ao servidor a transformação pretendida;
7. mostrar dry-run sem revelar segredos ou paths no servidor;
8. fazer parse e round-trip dos novos conteúdos em memória;
9. escrever todos os resultados em ficheiros temporários na mesma diretoria;
10. fazer flush/sync dos temporários;
11. criar backups de todos os originais;
12. substituir através de rename atómico por ficheiro;
13. reler, fazer parse e confirmar os hashes esperados;
14. se qualquer passo falhar, restaurar todos os originais;
15. guardar recibo local e reportar apenas metadados seguros ao vault.

Uma operação multi-ficheiro não é atomicamente garantida pelo filesystem. Por isso todos os novos
ficheiros são preparados e validados antes da primeira substituição, e qualquer falha inicia
rollback do conjunto.

### Preflight visível

Antes de aplicar:

- jogo encontrado e fechado;
- ficheiros encontrados;
- permissões de escrita;
- espaço para backup;
- parser compatível;
- número de settings alterados;
- settings sem mapeamento;
- conflitos com valores locais modificados depois do último apply;
- revisão e autor do preset;
- dispositivo alvo.

O utilizador vê `Ready`, `Warning` ou `Blocked`, com motivo concreto.

### Recibo de aplicação

Depois de aplicar:

- ID da operação;
- preset e revisão;
- dispositivo;
- hora;
- ficheiros lógicos alterados, sem path público;
- hash antes/depois;
- número de mudanças;
- localização local do backup, mostrada apenas no companion;
- resultado da validação;
- estado: applied, rolled_back, failed ou drifted.

O recibo permite responder a “o que foi escrito?” e suporta rollback sem adivinhar nomes de ficheiro.

### Rollback explícito

Comandos:

```text
csync history <game>
csync rollback <operation-id>
csync rollback <game> --latest
csync verify <game>
```

O rollback:

- verifica novamente que o jogo está fechado;
- cria backup do estado atual antes de restaurar;
- restaura o conjunto completo;
- valida o resultado;
- gera novo recibo;
- nunca elimina o snapshot cloud associado.

### Drift detection

Depois de um apply, o companion pode comparar os ficheiros atuais com a revisão aplicada:

- `In sync`;
- `3 local changes`;
- `Game rewrote 2 values`;
- `File missing`;
- `Parser incompatible`.

Drift não deve ser corrigido automaticamente no Free. No Pro, o auto-switch só reaplica depois de o
jogo fechar e deve respeitar safe mode após updates.

### Game Update Guard

Quando um patch muda formato, localização ou valores aceites:

- detetar falha de parse ou fingerprint estrutural desconhecido;
- suspender auto-apply para esse jogo;
- manter scan/dry-run disponível;
- mostrar “Compatibility review required”;
- nunca tentar “corrigir” um formato desconhecido;
- reativar depois de atualizar e testar o catálogo.

Opcionalmente, usar recibos anónimos agregados para saber que uma versão do catálogo aplicou e
validou com sucesso, sem recolher ficheiros.

### Limites de backup

- manter pelo menos os últimos 10 backups locais por jogo;
- permitir retenção por dias/espaço;
- nunca apagar o único backup de uma operação falhada;
- limpeza só depois de validar que o ficheiro atual é legível;
- paths e conteúdo dos backups ficam locais.

---

### 2.5 Compare, merge e apply seletivo

A comparação atual já é tipada, mas usa nome de categoria + nome de setting. Isto pode falhar se um
setting for renomeado. O catálogo precisa de um identificador estável por setting.

### Stable setting identity

Adicionar `catalogSettingId`, por exemplo:

```text
cs2.video.resolution
cs2.mouse.sensitivity
rocket-league.camera.fov
```

Regras:

- não muda quando o label muda;
- único dentro do catálogo;
- exportado/importado;
- settings manuais continuam sem ID e usam matching por nome;
- migrations associam IDs conhecidos a settings existentes;
- source keys do ficheiro não são identidade de produto: um setting pode mapear várias keys.

### Superfícies de comparação

- preset vs preset próprio;
- meu preset vs preset público;
- meu fork vs nova revisão da origem;
- preset vs estado local lido pelo companion;
- revisão antiga vs revisão atual;
- dispositivo A vs dispositivo B através dos estados importados, nunca lendo um PC remotamente sem
  consentimento.

### Compare view melhorado

- filtros Changed, Added, Removed, Same e Conflicts;
- pesquisa;
- agrupamento por categoria;
- valores default;
- origem e data de cada lado;
- indicador `local-only`, `mapped`, `unmapped`;
- copy diff;
- link partilhável de uma comparação pública/pinned;
- contexto de hardware quando altera o significado do setting.

### Selective Merge

Cada diferença tem checkbox. O utilizador pode:

- aceitar esquerda;
- manter direita;
- repor default;
- ignorar setting;
- selecionar categoria;
- guardar resultado como nova revisão;
- criar novo preset em vez de alterar o atual.

Antes de gravar, mostrar resumo: `12 accepted · 4 kept · 2 unsupported`.

### Three-way merge para forks

Usar três pontos:

- **Base:** revisão da origem quando o fork foi criado/atualizado;
- **Upstream:** nova revisão da origem;
- **Mine:** fork atual.

Classificação:

- mudou apenas upstream → seguro sugerir update;
- mudou apenas no fork → manter pessoal;
- ambos mudaram para o mesmo valor → resolvido;
- ambos mudaram de forma diferente → conflito manual;
- setting removido/incompatível → não aplicar automaticamente.

Isto transforma “copiar config de pro” numa relação atualizável sem destruir personalização.

### Apply selected changes

O resultado do merge cria primeiro uma revisão no vault. O companion recebe a revisão completa e o
Safe Apply calcula o patch sobre o ficheiro local. Nunca enviar instruções arbitrárias de escrita do
browser para o companion.

---

## 3. Funcionalidades adicionais que diferenciam de verdade

### 3.1 Config Doctor

Um analisador determinístico por jogo, sem depender de IA:

- valor fora do intervalo conhecido;
- bind duplicado ou em conflito;
- resolução/aspect ratio incompatível;
- setting conhecido mas não guardado no ficheiro esperado;
- chave obsoleta após update;
- múltiplos ficheiros a definir a mesma opção;
- preset incompleto para uma categoria importante;
- diferença entre valor no vault e valor que o jogo realmente reteve;
- backup em falta antes de uma operação antiga.

Cada regra tem:

- ID estável;
- severidade info/warning/blocking;
- explicação;
- fonte no catálogo;
- correção sugerida;
- opção de ignorar quando seguro.

Não chamar “erro” a preferência pessoal nem afirmar impacto em FPS sem prova.

### 3.2 Round-trip verification

Depois de o jogador abrir e fechar o jogo:

1. o companion volta a ler os ficheiros;
2. compara com o preset aplicado;
3. identifica valores que o jogo normalizou, rejeitou ou substituiu;
4. permite aceitar o estado real como nova revisão ou reaplicar seletivamente.

Isto responde a um problema que cloud backups não resolvem: saber se o jogo aceitou realmente a
config.

### 3.3 Setup Context

Settings profissionais sem contexto podem induzir em erro. Guardar, de forma opcional:

- mouse DPI e polling rate;
- resolução e refresh rate;
- aspect ratio/scaling;
- input method;
- plataforma/launcher;
- versão do jogo ou época competitiva;
- notas do autor sobre objetivo do preset.

O companion só deteta automaticamente o que puder obter com segurança e clareza. O resto é
declarado pelo utilizador. Mostrar sempre qual campo é detected e qual é self-reported.

Benefícios:

- calcular eDPI corretamente;
- comparar setups equivalentes;
- evitar copiar sensibilidade sem DPI;
- criar share cards úteis;
- melhorar filtros de descoberta.

### 3.4 LAN Pass

Fluxo futuro para PC temporário:

1. gerar QR/code de sessão com validade de 15 minutos;
2. autenticar o companion sem expor token permanente;
3. escolher pinned snapshot;
4. preflight + apply seguro;
5. sessão expira automaticamente;
6. opção de rollback ao estado anterior;
7. apagar token e estado pessoal local;
8. recibo fica na conta, sem guardar hostname público.

Antes de lançar, testar em máquina partilhada e definir claramente o que acontece a Steam Cloud,
ficheiros locais e credenciais. Esta funcionalidade pode abrir parcerias com LANs e bootcamps.

### 3.5 Team Rooms

Para equipas e coaches, depois de amigos e lineage estarem sólidos:

- espaço de equipa;
- roster e roles owner/coach/player/viewer;
- presets oficiais da equipa;
- propostas de alteração;
- compare e aprovação antes de publicar;
- pinned tournament version;
- atribuição por jogador/dispositivo continua pessoal;
- audit log;
- saída da equipa não apaga forks pessoais permitidos.

Não construir billing por seat antes de existir procura de três equipas reais.

### 3.6 Compatibility status baseado em provas

Cada jogo/preset pode mostrar:

- catálogo atualizado em determinada data;
- última versão testada;
- número agregado de applies validados recentemente;
- regressões conhecidas;
- plataforma/launcher confirmado.

Nunca mostrar “100% safe” ou números fabricados. Um apply bem sucedido não prova compatibilidade
com anti-cheat. O status refere apenas leitura/escrita/validação de configs.

### 3.7 Game request com contribuição estruturada

Para crescer catálogo sem uma lista vazia:

- pedir jogo/launcher/plataforma;
- mostrar contagem de pedidos reais;
- recolher paths e exemplos de ficheiros com consentimento;
- checklist de validação;
- estado Requested, Researching, Testing, Supported;
- não aceitar executáveis ou ficheiros com credenciais;
- recompensa contributors com crédito público opcional, não promessa de prazo.

---

## 4. O que fica Free e o que fica Pro

Segurança, partilha e crescimento não devem ser bloqueados de forma que prejudique confiança ou o
loop viral.

### Free

- amigos e follows;
- perfil e presets públicos;
- friends/unlisted/public sharing;
- pinned links com limite razoável;
- guardar um preset público como fork;
- comparar dois presets;
- selective merge manual;
- dry-run, preflight, backup, validação e rollback;
- recibos locais;
- Config Doctor básico;
- até 3 jogos e 10 snapshots, como hoje.

### Pro

- histórico ilimitado e comparação entre qualquer revisão;
- auto-switch;
- preset diferente por PC;
- alertas de drift e round-trip contínuo;
- acompanhar updates upstream de muitos presets;
- bundles maiores e analytics avançada de partilha;
- Team Rooms, quando existirem;
- LAN Pass avançado/múltiplas sessões, se os custos justificarem;
- AI screenshot import dentro de limites economicamente sustentáveis.

### Nunca pagar para ter

- backup antes de escrever;
- deteção de jogo aberto;
- rollback de uma operação feita pelo companion;
- aviso de incompatibilidade;
- exportar os próprios dados;
- bloquear/reportar utilizadores;
- privacidade básica.

### Verificação não se compra

Um creator pode pagar Pro, mas não paga pelo badge. Identity/setup verification depende de prova e
processo editorial. Patrocínios são identificados separadamente.

---

## 5. Modelo de dados proposto

Nomes finais podem mudar, mas as responsabilidades devem ficar separadas.

### Relações sociais

```text
friendships
  requester_user_id
  addressee_user_id
  status: pending | accepted | ignored
  created_at | responded_at

follows
  follower_user_id
  followed_user_id
  created_at

blocks
  blocker_user_id
  blocked_user_id
  created_at
```

Constraints:

- par de amizade único independentemente da ordem;
- bloquear remove/oculta friendship e follow nos reads;
- ações idempotentes;
- rate limit por utilizador/IP;
- nenhuma cascade pode apagar presets de outro utilizador.

### Verificação

```text
profile_verifications
  user_id
  kind: player | creator | coach | team
  status: pending | verified | rejected | revoked
  evidence_private
  verified_by
  verified_at | expires_at

preset_verifications
  preset_id
  revision_id
  method: companion_receipt | owner_attested | team_attested | editorial
  apply_receipt_id?
  verified_at
```

Evidence é privado e com retenção definida. A UI pública recebe apenas método, status e datas.

### Lineage e subscrições

```text
preset_origins
  child_preset_id
  source_preset_id?
  source_revision_id?
  source_author_user_id?
  source_content_hash
  copied_at
  detached_at?

preset_subscriptions
  user_id
  source_preset_id
  last_seen_revision_id?
  muted_at?
```

Se a origem for apagada, preservar apenas metadados mínimos necessários e respeitar pedidos de
eliminação. Não manter conteúdo privado através de lineage.

### Partilha

```text
preset_visibility: private | friends | unlisted | public

share_links
  preset_id | revision_id?
  token_hash
  mode: live | pinned
  expires_at?
  revoked_at?
  created_by

setup_bundles
bundle_items
```

Guardar hash do token, não token em claro, seguindo o padrão dos companion tokens.

### Atividade e notificações

```text
activity_events
  actor_user_id
  kind
  subject_type | subject_id
  visibility
  occurred_at

notifications
  recipient_user_id
  event_id
  read_at?
```

Eventos são allowlisted e gerados no servidor. Não aceitar texto arbitrário do companion para o
feed.

### Apply receipts

```text
apply_receipts
  operation_id
  user_id | device_id | game_id | preset_id | revision_id
  catalog_version
  status
  changed_setting_count
  logical_file_ids
  before_hashes | after_hashes
  started_at | finished_at
```

Não enviar paths absolutos, conteúdo dos ficheiros ou nomes de backups ao servidor. O detalhe local
fica num journal do companion com permissões 0600.

### Identidade estável de settings

Adicionar `catalog_setting_id` opcional aos settings e ao formato de export. Validar unicidade no
catálogo durante tests/build.

---

## 6. Privacidade, abuso e direitos

Social e configs de pessoas reais criam riscos que hoje não existem.

### Defaults

- perfil privado;
- preset privado;
- presença desligada;
- requests por username/link;
- notificações de marketing desligadas;
- notes sempre privadas salvo campo explícito de descrição pública.

### Proteções

- block e report disponíveis em todas as páginas públicas;
- rate limit em friend requests, follows, reports e share-link creation;
- reserved usernames para marcas/equipas;
- audit log para ações de moderação;
- processo de impersonation/takedown;
- revogação de badge;
- não permitir upload público de executáveis;
- sanitizar links e manter `nofollow` onde adequado;
- idade mínima e termos revistos antes de social público;
- email de segurança/moderação com SLA interno simples.

### Direitos sobre configs de pros

Valores individuais podem ser factos, mas nomes, imagens, logos, conteúdo de ficheiros e endorsement
podem ter direitos e contexto. Política:

- preferir perfis reclamados;
- atribuir fonte e data;
- não usar foto/logo sem licença;
- remover rapidamente a pedido do titular;
- distinguir “verified by owner” de “collected from public source”;
- não sugerir parceria com uma equipa sem acordo;
- não vender configs individuais de terceiros.

---

## 7. Ordem de implementação

As fases são dependentes. Não começar pelo diretório de pros.

### Fase 0 — Safety contract e identidade estável

**Objetivo:** tornar a promessa de aplicação segura verdadeira em todos os caminhos.

- centralizar process check no writer;
- bloquear manual apply com jogo aberto;
- preparar ficheiros temporários e validação antes da substituição;
- rollback em falha;
- journal local e operation ID;
- `csync history`, `verify`, `rollback`;
- testes de falha a meio de operação multi-ficheiro;
- `catalogSettingId` e migração inicial;
- versão explícita do catálogo.

**Gate:** nenhum comando consegue escrever com processo aberto; falha simulada restaura bytes
originais; testes em Windows e Linux.

### Fase 1 — Share → fork → compare → merge

**Objetivo:** criar o loop diferenciador antes do feed social.

- visibility friends/unlisted/public;
- live e pinned share links;
- lineage ao guardar no vault;
- comparar público vs meu;
- selective merge;
- three-way merge de update upstream;
- share card real;
- notificações in-app de nova revisão seguida;
- analytics agregada básica.

**Gate:** copiar uma revisão, personalizá-la, publicar update na origem e integrar apenas duas
mudanças sem perder as alterações pessoais.

### Fase 2 — Amigos, follows e presença

**Objetivo:** distribuir presets entre relações reais.

- friendships, follows, blocks;
- pesquisa por username e invite link;
- feed cronológico allowlisted;
- privacy controls;
- presença opt-in baseada em heartbeat;
- Playing apenas com processo explicitamente reportado;
- friends-only sharing;
- report/moderação mínima.

**Gate:** bloqueio remove todas as superfícies; presença privada nunca aparece; feed não expõe saves
privados nem dispositivos.

### Fase 3 — Creators e pros verificados

**Objetivo:** lançar 10 setups vivos e reclamados.

- fluxo de claim e backoffice manual;
- badges separados identity/setup;
- Setup Context;
- página de creator/pro;
- update subscriptions;
- changelog por preset;
- convite e onboarding assistido;
- diretório editorial pequeno.

**Gate:** consentimento e fonte para todos os perfis; revisão atual aplicável; update chega ao fork
como merge, não overwrite.

### Fase 4 — Config Doctor e Game Update Guard

**Objetivo:** transformar conhecimento do catálogo em confiança recorrente.

- rule engine;
- primeiras regras CS2/Rocket League;
- round-trip verification;
- drift details;
- compatibilidade por catálogo/plataforma;
- suspensão automática segura após incompatibilidade;
- fluxo de aceitar estado real como nova revisão.

**Gate:** update incompatível bloqueia escrita sem falso “Synced”; rules têm testes e explicações.

### Fase 5 — LAN Pass e Team Rooms

**Objetivo:** abrir distribuição B2B depois de provar o core.

- sessão temporária e QR;
- expiração/revogação;
- cleanup local;
- rollback pós-LAN;
- rooms, roles, approvals e audit;
- três pilotos reais antes de billing por seat.

**Gate:** threat model revisto; nenhum token permanente fica na máquina; saída da equipa respeita
ownership.

---

## 8. Critérios de aceitação por superfície

### Friends

- requests idempotentes;
- aceitar/rejeitar sem race;
- block prevalece sobre todas as queries;
- utilizador privado não aparece em discovery;
- dados vazios mostram estado honesto, não sugestões inventadas;
- acessibilidade por teclado e screen reader;
- testes de autorização entre três contas.

### Pro setup

- badge tem método e data;
- revisão verificada é imutável;
- versão nova não herda automaticamente verificação;
- retirar badge não apaga preset;
- fonte pública disponível;
- copy cria lineage;
- notes privadas nunca saem.

### Share

- revoked/expired retorna 404 ou estado explícito sem conteúdo;
- token impossível de enumerar;
- pinned não muda quando o preset live muda;
- live respeita mudança para private imediatamente;
- OG contém apenas dados públicos;
- export público não inclui notes.

### Apply

- process check imediatamente antes de write;
- dry-run e apply produzem o mesmo diff;
- backup existe antes da primeira substituição;
- erro forçado após o primeiro ficheiro recupera todos;
- permissões originais preservadas;
- path traversal impossível;
- server não escolhe paths arbitrários;
- receipt não contém conteúdo/path;
- rollback também faz backup;
- concorrência de dois applies é serializada por lock local.

### Compare/merge

- stable IDs prevalecem sobre labels;
- fallback por nome não mistura settings ambíguos;
- three-way merge classifica conflitos corretamente;
- resultado é preview antes de save;
- save cria snapshot;
- apply só usa revisão guardada;
- unsupported nunca é silenciosamente descartado.

---

## 9. Rotas e navegação propostas

Reutilizar o design atual, `Panel` e `PageHeader`.

```text
/friends
/activity
/discover
/discover/players
/p/<username>
/p/<username>/<game>/<preset>
/p/<username>/<game>/<preset>/versions/<revision>
/games/<game>/compare?mine=<id>&source=<public-revision>
/settings/social
/settings/privacy
/settings/verification
```

O dashboard substitui cada `Coming soon` apenas quando a respetiva query devolver dados reais:

- Friends → amigos/presença real;
- Public profiles → presets públicos editoriais/reais;
- Pro players → perfis verificados.

Discovery inicial é editorial e filtrável. Não precisa de algoritmo:

- jogo;
- atualizado recentemente;
- verified identity;
- verified setup;
- mais copiados, com janela temporal e proteção contra abuso;
- creators seguidos.

---

## 10. Métricas de produto

### North star

**Weekly Trusted Applies:** utilizadores únicos que aplicaram e validaram uma revisão com recibo
durante a semana.

Uma aplicação sem validação conta separadamente. Isto alinha utilização com a promessa de segurança.

### Loop social

- friend requests aceites;
- follows por perfil ativo;
- percentagem de ativados que partilha preset;
- visitas → compare;
- compare → fork;
- fork → apply validado;
- update upstream → merge;
- creators com pelo menos um fork aplicado.

### Segurança

- writes bloqueados por jogo aberto;
- applies com rollback;
- falhas de validação;
- drift após primeira abertura;
- tempo médio de recuperação;
- operações sem backup — objetivo absoluto: zero;
- versões de catálogo suspensas por incompatibilidade.

### Qualidade de pro configs

- percentagem owner-claimed;
- idade mediana da verificação;
- revisões com receipt;
- configs incompletas;
- reports/takedowns;
- updates integrados sem conflito.

Não usar total de profiles ou total de configs como métrica principal; diretórios enormes e
desatualizados não criam confiança.

---

## 11. Lançamento de cada fase

### Safe Apply v2

Conteúdo: vídeo com falha simulada, rollback e bytes originais restaurados. Publicar a especificação
de segurança em linguagem simples.

### Lineage + merge

Conteúdo: creator muda três settings; follower aceita dois e mantém a sensibilidade pessoal.

### Friends

Convite fechado: cada utilizador recebe três invite links. Medir amizades aceites e partilhas, não
número de convites enviados.

### Pro configs

Lançar perfil a perfil com o respetivo creator. Cada publicação mostra data, contexto e como foi
verificada. Não anunciar “hundreds of pros”.

### Config Doctor

Conteúdo: casos reais de conflito encontrados e explicação técnica. Sem promessas vagas de
“optimization”.

### LAN Pass

Case study numa LAN real: tempo de login até setup aplicado, rollback e credenciais removidas.

---

## 12. Funcionalidades que parecem boas mas não vamos construir agora

- **Diretório massivo de pros scraped:** concorre por volume, envelhece depressa e cria problemas
  de direitos/confiança.
- **Marketplace de configs pagas:** incentiva claims duvidosos e suporte/refunds antes de existir
  procura.
- **Chat/comments:** grande custo de moderação e pouco valor para apply/compare.
- **Likes e gamification:** métricas fáceis de manipular que não provam uso.
- **AI coach que recomenda settings:** sem evidência individual, mistura preferência com conselho.
- **Auto-apply de updates de creators:** perigoso e destrói personalização.
- **Cloud execution remota:** o servidor nunca escreve diretamente num PC.
- **Upload arbitrário de scripts/autoexec executável:** superfície de segurança desnecessária.
- **Online/playing inferido sem opt-in:** quebra confiança.
- **Compatibility/anti-cheat badge absoluto:** impossível garantir de forma responsável.

---

## 13. As próximas 30 tarefas, por ordem

1. Criar issue P0 para centralizar o game-running check.
2. Escrever teste que prova que `csync apply` não escreve com jogo aberto.
3. Introduzir lock local por jogo.
4. Projetar journal/operation ID local.
5. Implementar staging em ficheiros temporários.
6. Implementar rollback automático multi-ficheiro.
7. Adicionar `history`, `verify` e `rollback` ao companion.
8. Definir formato de apply receipt sem paths/conteúdo.
9. Adicionar versão ao catálogo.
10. Definir `catalogSettingId` e validar unicidade.
11. Migrar CS2 e Rocket League para IDs estáveis.
12. Adicionar `friends` e `unlisted` ao modelo de visibility.
13. Criar live/pinned share links com token hash.
14. Guardar lineage ao copiar preset público.
15. Permitir compare entre preset público e meu preset.
16. Construir selective merge com preview.
17. Construir three-way merge e testes de conflito.
18. Gerar OG de preset com dados reais.
19. Criar follows e notificações de nova revisão.
20. Criar friendships e blocks.
21. Implementar friends-only reads com testes de autorização.
22. Adicionar privacy controls e presença opt-in.
23. Estender heartbeat com processo de jogo apenas quando autorizado.
24. Criar feed allowlisted e cronológico.
25. Definir política de verification/impersonation/takedown.
26. Criar backoffice mínimo de claim e badges.
27. Recrutar os primeiros 10 creators/players.
28. Implementar primeiras regras do Config Doctor.
29. Implementar round-trip verification.
30. Só então desenhar piloto de LAN Pass/Team Rooms.

---

## 14. Fontes e contexto competitivo

- [ConfigSave](https://configsave.com/) — backup/sync de configs Steam, aplicação Windows e preço
  mensal diretamente comparável.
- [Checkpoint64](https://store.steampowered.com/app/4790820/Checkpoint64_Game_Save_Backup__Cloud_Sync/)
  — versões de saves/configs e distribuição pela Steam.
- [Ludusavi](https://github.com/mtkennerly/ludusavi) — backup local amplo e gratuito.
- [Octarine Cloud Configs](https://octarinecore.cc/en/cloud-configs/) — sync, share codes, galeria e
  acesso dentro do seu ecossistema.
- [Pro Config](https://proconfig.net/cs2/) — diretório de configs profissionais.
- [CS2Config](https://cs2config.net/) — pro settings, compare e downloads.
- [CS2Settings](https://cs2settings.com/) — base ampla de settings e hardware.

Estes produtos provam que backup, pro tables e partilha isolados já existem. O espaço defensável do
ConfigSync é a cadeia completa e segura: **proveniência → diff → fork → merge → apply → verify →
rollback → update**.
