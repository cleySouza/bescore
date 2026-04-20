# BeScore – Regras de Negócio, Feature Flags e Fluxos

## 1. Feature Flags (FF)

### O que são
Feature Flags (FF) são controles dinâmicos de acesso e rollout de funcionalidades, baseados em regras armazenadas no banco (Supabase). Permitem liberar/bloquear recursos para todos ou para usuários/grupos específicos sem precisar redeployar o app.

### Estrutura
- **Tabela:** `feature_flags`
  - `key`: identificador da flag (ex: `app_rollout_gate`)
  - `enabled`: se a flag está ativa
  - `default_allow`: valor padrão (true/false) para quem não tem regra específica
- **Tabela:** `feature_flag_access`
  - `flag_key`: referência à flag
  - `user_id` (opcional): id do usuário
  - `email` (opcional): email do usuário
  - `allow`: true (libera) ou false (bloqueia)

### Como funciona o controle
- Se a flag está **desativada** (`enabled = false`): todos têm acesso.
- Se a flag está **ativada** (`enabled = true`):
  - Procura regra específica para o usuário (por `user_id` ou `email`).
    - Se houver `allow = false`, bloqueia.
    - Se houver `allow = true` e nenhuma `allow = false`, libera.
  - Se não houver regra, aplica `default_allow` (normalmente `false` para bloquear geral).
- **Importante:** nunca mantenha múltiplas linhas para o mesmo usuário/email e flag. Use `update` para alterar.

### Fluxo de manutenção
- Para bloquear todos: `enabled = true`, `default_allow = false`, sem regras específicas.
- Para liberar só alguns: insira uma linha com `allow = true` para cada usuário.
- Para trocar status: `update` na linha do usuário.
- Para resetar: `delete` todas as linhas da flag e recomece.

---

## 2. Criação de Torneio

### Fluxo
1. Usuário autenticado acessa a tela de criação.
2. Preenche nome, formato, times, regras e configurações.
3. Ao criar:
   - Um registro é inserido em `tournaments` com `creator_id = auth.uid()`.
   - Times são associados (predefinidos ou não).
   - Participantes iniciais podem ser criados.
   - Status inicial: `draft` ou `active`.

#### Geração de Fases Finais (Playoff)
- Para torneios com 4 classificados (top4):
  - Ao gerar a fase final, são criadas as semifinais (1º vs 4º, 2º vs 3º).
  - Assim que ambas as semifinais estiverem finalizadas e houver vencedores, a final é criada automaticamente entre os vencedores.
  - Se houver empate em alguma semifinal, é necessário definir o vencedor antes de gerar a final.
- Para torneios com 2 classificados (top2):
  - A final direta é criada normalmente.

### Regras de negócio
- Só usuários autenticados podem criar torneios.
- O criador é sempre admin do torneio.
- Torneios podem ser públicos (visíveis para todos) ou privados (acesso por convite/código).
- O criador pode editar, excluir e gerenciar participantes enquanto o torneio está em `draft`.
- Após início (`active`), algumas edições são bloqueadas.
- Torneios podem ser finalizados (`finished`) e ficam só leitura.

---

## 3. Regras de Participação e Times

### Modos de times
- **Predefinidos manual:** criador define os times e participantes escolhem entre os disponíveis.
- **Predefinidos automático:** sistema sorteia times para os participantes.
- **Sem times predefinidos:** cada participante escolhe nome/time livremente.

### Regras de entrada
- Usuário só pode entrar em torneio público ou se tiver convite/código válido.
- Se modo manual, só pode escolher times ainda não ocupados.
- Se modo automático, não escolhe time (é sorteado).
- Se não predefinido, pode escolher qualquer nome/time.
- Não pode entrar duas vezes no mesmo torneio.

---

## 4. Regras de Segurança e Políticas (RLS)

### Tabelas principais
- `tournaments`: só criador pode editar/excluir; todos autenticados podem ver públicos.
- `participants`: só o próprio usuário ou criador pode editar/excluir.
- `matches`: só criador do torneio pode criar/editar/deletar.
- `profiles`: cada usuário só pode editar seu próprio perfil.
- `feature_flags` e `feature_flag_access`: só leitura pelo app, escrita apenas por admin via backend seguro.

### Recomendações
- Sempre use RLS (Row Level Security) ativo.
- Policies devem ser específicas por ação (select, insert, update, delete).
- Nunca conceda permissões amplas para `anon` ou `authenticated` sem RLS.
- Audite grants e policies periodicamente.

---

## 5. Resumo de Fluxos e Recomendações

- **Feature Flags:** controle rollout e acesso dinâmico, nunca mantenha múltiplas regras conflitantes para o mesmo usuário.
- **Criação de Torneio:** só autenticado, criador é admin, regras de edição por status.
- **Participação:** regras variam conforme modo de times, sempre garantir unicidade de entrada.
- **Segurança:** RLS sempre ativo, policies restritivas, escrita em feature flag só por backend/admin.

---

**Dúvidas ou ajustes:** revise este documento e consulte o código-fonte das policies e dos fluxos principais para detalhes de implementação.
