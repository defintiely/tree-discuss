-- Таблица комнат Tree Discuss.
-- Пароль здесь не хранится: verifier выведен из него односторонне, а payload
-- зашифрован ключом, который остаётся в браузере. Прочитавший таблицу
-- не получает ни пароля, ни текста обсуждения.

create table if not exists public.rooms (
  name        text primary key,
  verifier    text not null,
  payload     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.rooms enable row level security;

-- Кто знает название комнаты — может её прочитать, но содержимое без пароля
-- не расшифруется. Проверка пароля идёт по verifier на стороне клиента.
create policy rooms_select on public.rooms
  for select using (true);

create policy rooms_insert on public.rooms
  for insert with check (
    length(name) between 1 and 80
    and length(verifier) = 64
    and length(payload) < 4000000
  );

-- Запись разрешена только тому, кто предъявил тот же verifier, что уже лежит
-- в строке: без пароля комнату не перезаписать.
create policy rooms_update on public.rooms
  for update using (true)
  with check (verifier = (select r.verifier from public.rooms r where r.name = rooms.name));

-- Политики DELETE нет намеренно: комнату нельзя стереть из браузера, даже зная
-- пароль. Ненужные комнаты удаляет владелец проекта через SQL Editor.

-- updated_at is set by the DATABASE, not the browser: participants' clocks differ
-- by seconds, and an edit stamped by a slow clock would look older than the cloud
-- copy and get overwritten by it. `default now()` only fires on insert, hence the trigger.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
