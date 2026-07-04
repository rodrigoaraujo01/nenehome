-- nenehome — Loja de Cosméticos (sink de nenecoins, puramente visual)
-- Run LAST, AFTER powerups.sql.
-- Modelo inventário: compra (cosmetic_ledger) → equipa/desequipa (cosmetics_equipped).
-- Diferente de power-ups: NÃO consumível — compra 1×, equipa/troca à vontade (1 por slot).
-- Slots: avatar_frame (moldura), name_style (cor/gradiente do nick), question_flair (reservado).

-- ─────────────────────────────────────────────
-- nenecoins_ledger tx_type: add cosmetic_purchase
-- ─────────────────────────────────────────────
alter table nenecoins_ledger drop constraint if exists nenecoins_ledger_tx_type_check;
alter table nenecoins_ledger add constraint nenecoins_ledger_tx_type_check
  check (tx_type in (
    'initial', 'weekly_bonus', 'points_conversion',
    'bet_placed', 'bet_won', 'bet_refund',
    'gift_sent', 'gift_received',
    'fire_conversion_out', 'fire_conversion_in',
    'wc_bet_placed', 'wc_bet_won', 'wc_bet_refund', 'wc_bet_clawback',
    'powerup_purchase', 'question_bet_placed', 'question_bet_won',
    'cosmetic_purchase'
  ));

-- ─────────────────────────────────────────────
-- cosmetics — catálogo (server-authoritative)
-- payload jsonb carrega os dados de render (cores/gradiente/animação).
-- season null = sempre disponível; 'copa'/'natal'/... = sazonal (liga/desliga via active).
-- ─────────────────────────────────────────────
create table if not exists cosmetics (
  key         text primary key,
  slot        text not null check (slot in ('avatar_frame', 'name_style', 'question_flair')),
  title       text not null,
  description text not null,
  price       integer not null check (price > 0),
  rarity      text not null default 'comum' check (rarity in ('comum', 'raro', 'lendario')),
  season      text,
  payload     jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  sort        integer not null default 0
);

alter table cosmetics enable row level security;
drop policy if exists "cosmetics: authenticated can read" on cosmetics;
create policy "cosmetics: authenticated can read"
  on cosmetics for select using (auth.role() = 'authenticated');

-- Catálogo inicial: molduras de avatar + estilos de nome.
-- question_flair fica reservado no schema, sem itens ainda (ativa depois sem migração).
insert into cosmetics (key, slot, title, description, price, rarity, season, payload, sort) values
  -- Molduras (avatar_frame). payload.ring: 'solid' | 'gradient'; animate = pulso.
  ('frame_gold',   'avatar_frame', 'Moldura Ouro',    'Anel dourado sólido em volta do avatar.',            40,  'comum',    null,   '{"ring":"solid","color":"#f59e0b"}', 1),
  ('frame_rose',   'avatar_frame', 'Moldura Rosé',    'Anel rosa suave.',                                    40,  'comum',    null,   '{"ring":"solid","color":"#ec4899"}', 2),
  ('frame_neon',   'avatar_frame', 'Moldura Neon',    'Gradiente violeta→rosa vibrante.',                    100, 'raro',     null,   '{"ring":"gradient","from":"#a78bfa","to":"#ec4899"}', 3),
  ('frame_ocean',  'avatar_frame', 'Moldura Oceano',  'Gradiente ciano→azul.',                               100, 'raro',     null,   '{"ring":"gradient","from":"#22d3ee","to":"#3b82f6"}', 4),
  ('frame_fire',   'avatar_frame', 'Moldura Fogo',    'Gradiente âmbar→vermelho pulsante.',                  250, 'lendario', null,   '{"ring":"gradient","from":"#f59e0b","to":"#ef4444","animate":true}', 5),
  ('frame_copa',   'avatar_frame', 'Moldura Copa 2026', 'Verde-amarelo comemorativo da Copa. Edição limitada.', 250, 'lendario', 'copa', '{"ring":"gradient","from":"#16a34a","to":"#facc15","animate":true}', 6),
  -- Estilos de nome (name_style). payload.color (sólido) OU payload.gradient [a,b].
  ('name_gold',    'name_style',   'Nome Dourado',    'Seu nick em dourado.',                                40,  'comum',    null,   '{"color":"#f59e0b"}', 10),
  ('name_violet',  'name_style',   'Nome Violeta',    'Seu nick em violeta.',                                40,  'comum',    null,   '{"color":"#a78bfa"}', 11),
  ('name_sunset',  'name_style',   'Nome Pôr do Sol', 'Gradiente laranja→rosa no nick.',                     100, 'raro',     null,   '{"gradient":["#fb923c","#ec4899"]}', 12),
  ('name_aurora',  'name_style',   'Nome Aurora',     'Gradiente verde→ciano→violeta.',                      250, 'lendario', null,   '{"gradient":["#34d399","#22d3ee","#a78bfa"]}', 13)
on conflict (key) do update set
  slot = excluded.slot, title = excluded.title, description = excluded.description,
  price = excluded.price, rarity = excluded.rarity, season = excluded.season,
  payload = excluded.payload, sort = excluded.sort;

-- ─────────────────────────────────────────────
-- cosmetic_ledger — posse como ledger derivado (espelha powerup_ledger).
-- qty(user, key) = sum(delta). Cosmético não é consumível: qty é 0 ou 1.
-- ─────────────────────────────────────────────
create table if not exists cosmetic_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  cosmetic_key text not null references cosmetics(key),
  delta        integer not null,
  reason       text not null check (reason in ('purchase', 'refund')),
  created_at   timestamptz not null default now()
);

alter table cosmetic_ledger enable row level security;
drop policy if exists "cosmetic_ledger: owner reads own" on cosmetic_ledger;
create policy "cosmetic_ledger: owner reads own"
  on cosmetic_ledger for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- cosmetics_equipped — item equipado por slot (1 por slot). Desequipar = deletar.
-- ─────────────────────────────────────────────
create table if not exists cosmetics_equipped (
  user_id      uuid not null references profiles(id),
  slot         text not null check (slot in ('avatar_frame', 'name_style', 'question_flair')),
  cosmetic_key text not null references cosmetics(key),
  updated_at   timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table cosmetics_equipped enable row level security;
-- Leitura pública (autenticados): precisa decorar avatares/nomes de TODOS no ranking, comentários, etc.
drop policy if exists "cosmetics_equipped: authenticated can read" on cosmetics_equipped;
create policy "cosmetics_equipped: authenticated can read"
  on cosmetics_equipped for select using (auth.role() = 'authenticated');

-- helper: quantidade possuída
create or replace function cosmetic_qty(p_user uuid, p_key text)
returns integer
language sql
stable
as $$
  select coalesce(sum(delta), 0)::integer
  from cosmetic_ledger where user_id = p_user and cosmetic_key = p_key;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_cosmetic_inventory — itens possuídos pelo usuário + flag equipped
-- ─────────────────────────────────────────────
create or replace function get_cosmetic_inventory()
returns json
language sql
security definer
as $$
  select coalesce(json_agg(json_build_object(
    'cosmetic_key', l.cosmetic_key,
    'equipped', (e.cosmetic_key is not null)
  ) order by l.cosmetic_key), '[]'::json)
  from (
    select cosmetic_key
    from cosmetic_ledger
    where user_id = auth.uid()
    group by cosmetic_key
    having sum(delta) > 0
  ) l
  left join cosmetics c on c.key = l.cosmetic_key
  left join cosmetics_equipped e
    on e.user_id = auth.uid() and e.slot = c.slot and e.cosmetic_key = l.cosmetic_key;
$$;

-- ─────────────────────────────────────────────
-- RPC: get_equipped_cosmetics — público: cosméticos equipados de TODOS os membros
-- Usado no front pra decorar avatares/nomes onde quer que apareçam.
-- Retorna nickname (chave ubíqua no front) além do user_id.
-- ─────────────────────────────────────────────
create or replace function get_equipped_cosmetics()
returns json
language sql
security definer
as $$
  select coalesce(json_agg(json_build_object(
    'user_id', e.user_id,
    'nickname', p.nickname,
    'slot', e.slot,
    'payload', c.payload
  )), '[]'::json)
  from cosmetics_equipped e
  join cosmetics c on c.key = e.cosmetic_key
  join profiles p on p.id = e.user_id;
$$;

-- ─────────────────────────────────────────────
-- RPC: buy_cosmetic — debita nenecoins, credita posse. Bloqueia recompra.
-- ─────────────────────────────────────────────
create or replace function buy_cosmetic(p_key text)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id  uuid := auth.uid();
  v_cos      cosmetics%rowtype;
  v_balance  integer;
  v_new_bal  integer;
begin
  select * into v_cos from cosmetics where key = p_key and active = true;
  if not found then
    return json_build_object('error', 'Cosmético indisponível');
  end if;

  if cosmetic_qty(v_user_id, p_key) > 0 then
    return json_build_object('error', 'Você já possui este cosmético');
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

  if v_balance < v_cos.price then
    return json_build_object('error', 'Nenecoins insuficientes');
  end if;

  insert into nenecoins_ledger (user_id, amount, coin_type, tx_type, note)
  values (v_user_id, -v_cos.price, 'nenecoin', 'cosmetic_purchase',
    'Loja: ' || v_cos.title);

  insert into cosmetic_ledger (user_id, cosmetic_key, delta, reason)
  values (v_user_id, p_key, 1, 'purchase');

  insert into nenecoins_state (user_id, last_activity_at)
  values (v_user_id, now())
  on conflict (user_id) do update set last_activity_at = now();

  select coalesce(sum(amount), 0) into v_new_bal
  from nenecoins_ledger where user_id = v_user_id and coin_type = 'nenecoin';

  return json_build_object(
    'success', true,
    'key', p_key,
    'nenecoin_balance', v_new_bal
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: equip_cosmetic — equipa item possuído (upsert por slot)
-- ─────────────────────────────────────────────
create or replace function equip_cosmetic(p_key text)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_cos     cosmetics%rowtype;
begin
  select * into v_cos from cosmetics where key = p_key;
  if not found then
    return json_build_object('error', 'Cosmético inexistente');
  end if;

  if cosmetic_qty(v_user_id, p_key) < 1 then
    return json_build_object('error', 'Você não possui este cosmético');
  end if;

  insert into cosmetics_equipped (user_id, slot, cosmetic_key, updated_at)
  values (v_user_id, v_cos.slot, p_key, now())
  on conflict (user_id, slot) do update
    set cosmetic_key = excluded.cosmetic_key, updated_at = now();

  return json_build_object('success', true, 'slot', v_cos.slot, 'key', p_key);
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: unequip_slot — desequipa o slot
-- ─────────────────────────────────────────────
create or replace function unequip_slot(p_slot text)
returns json
language plpgsql
security definer
as $$
begin
  delete from cosmetics_equipped where user_id = auth.uid() and slot = p_slot;
  return json_build_object('success', true, 'slot', p_slot);
end;
$$;

grant execute on function get_cosmetic_inventory() to authenticated;
grant execute on function get_equipped_cosmetics() to authenticated;
grant execute on function buy_cosmetic(text) to authenticated;
grant execute on function equip_cosmetic(text) to authenticated;
grant execute on function unequip_slot(text) to authenticated;
