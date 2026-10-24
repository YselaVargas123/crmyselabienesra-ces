-- Ampliación aditiva. Ejecutar una vez en el SQL Editor del proyecto
-- qzfnncblpsfefhsvldul (CRM inmobiliario), nunca en el del curso.
-- No reemplaza contacts, profiles, properties, opportunities ni activities.
begin;

create or replace function public.crm_wa_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and active = true)
$$;
create or replace function public.crm_wa_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and active = true and role = 'agente')
$$;

create table public.crm_wa_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 80),
  owner_id uuid not null default auth.uid() references auth.users(id),
  state text not null default 'offline' check(state in ('offline','connecting','connected','error')),
  phone text,
  heartbeat_at timestamptz,
  worker_id uuid,
  last_error text,
  created_at timestamptz not null default now()
);
create table public.crm_wa_pairings (
  device_id uuid primary key references public.crm_wa_devices(id) on delete cascade,
  qr text,
  updated_at timestamptz not null default now()
);
create table public.crm_wa_threads (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.crm_wa_devices(id),
  contact_id uuid references public.contacts(id),
  jid text not null,
  display_name text,
  last_message text,
  last_at timestamptz not null default now(),
  unique(device_id,jid)
);
create table public.crm_wa_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.crm_wa_threads(id),
  remote_id text not null,
  direction text not null check(direction in ('in','out')),
  body text not null default '',
  kind text not null default 'text' check(kind in ('text','image','audio','document','other')),
  media_path text,
  delivery text check(delivery in ('accepted','delivered','read','error')),
  created_at timestamptz not null default now(),
  unique(thread_id,remote_id)
);
create index crm_wa_messages_thread_date on public.crm_wa_messages(thread_id,created_at);
create table public.crm_wa_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.crm_wa_devices(id),
  requested_by uuid not null default auth.uid() references auth.users(id),
  action text not null check(action in ('connect','disconnect','send')),
  payload jsonb not null default '{}',
  state text not null default 'queued' check(state in ('queued','processing','done','failed','cancelled')),
  scheduled_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  claimed_at timestamptz,
  result text,
  created_at timestamptz not null default now(),
  check(expires_at > scheduled_at)
);
create index crm_wa_commands_pending on public.crm_wa_commands(device_id,scheduled_at) where state='queued';
create table public.crm_wa_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 1 and 80),
  body text not null check(length(trim(body)) between 1 and 4000),
  created_by uuid not null default auth.uid() references auth.users(id)
);
create table public.crm_wa_rules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.crm_wa_devices(id),
  title text not null check(length(trim(title)) between 1 and 80),
  keyword text not null check(length(trim(keyword)) between 1 and 100),
  match_mode text not null default 'exact' check(match_mode in ('exact','contains')),
  replies jsonb not null check(jsonb_typeof(replies)='array' and jsonb_array_length(replies) between 1 and 10),
  enabled boolean not null default false,
  cooldown_minutes integer not null default 1440 check(cooldown_minutes between 1 and 10080),
  created_at timestamptz not null default now()
);
create table public.crm_wa_rule_runs (
  rule_id uuid not null references public.crm_wa_rules(id),
  thread_id uuid not null references public.crm_wa_threads(id),
  last_at timestamptz not null default now(),
  primary key(rule_id,thread_id)
);

-- Arrendamiento: evita que dos computadoras atiendan la misma línea a la vez.
create or replace function public.crm_wa_lease(p_device uuid,p_worker uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
  update crm_wa_devices set worker_id=p_worker,heartbeat_at=now()
   where id=p_device and owner_id=auth.uid() and crm_wa_manager()
     and (worker_id=p_worker or heartbeat_at is null or heartbeat_at < now()-interval '45 seconds');
  get diagnostics n=row_count;
  return n=1;
end $$;

-- Reclamo atómico. Los envíos requieren una sesión conectada.
create or replace function public.crm_wa_claim(p_device uuid,p_worker uuid)
returns setof public.crm_wa_commands language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from crm_wa_devices where id=p_device and owner_id=auth.uid()
    and worker_id=p_worker and heartbeat_at > now()-interval '45 seconds') then return; end if;
  update crm_wa_commands set state='failed',result='Venció sin enviarse. Revisa y vuelve a programar.'
    where device_id=p_device and state='queued' and expires_at < now();
  -- Tras un cierre inesperado, un envío en proceso NO se reenvía a ciegas.
  update crm_wa_commands set state='failed',result='Envío interrumpido: comprueba WhatsApp antes de repetirlo.'
    where device_id=p_device and state='processing' and claimed_at < now()-interval '2 minutes';
  return query
    update crm_wa_commands set state='processing',claimed_at=now()
    where id in (select c.id from crm_wa_commands c join crm_wa_devices d on d.id=c.device_id
      where c.device_id=p_device and c.state='queued' and c.scheduled_at<=now() and c.expires_at>=now()
      and (c.action<>'send' or d.state='connected')
      order by c.scheduled_at,c.created_at limit 1 for update of c skip locked)
    returning crm_wa_commands.*;
end $$;

-- Nuevas conversaciones usan los contactos existentes, sin crear duplicados.
create or replace function public.crm_wa_open_thread(p_device uuid,p_contact uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare tel text; nom text; resultado uuid;
begin
  if not crm_wa_active() then raise exception 'Acceso no autorizado'; end if;
  select regexp_replace(coalesce(nullif(whatsapp,''),phone,''),'[^0-9]','','g'),
    trim(first_name||' '||last_name) into tel,nom from contacts where id=p_contact;
  if length(tel)=8 then tel='591'||tel; end if;
  if tel is null or length(tel)<10 or length(tel)>15 then raise exception 'Revisa el número del contacto'; end if;
  insert into crm_wa_threads(device_id,contact_id,jid,display_name)
    values(p_device,p_contact,tel||'@s.whatsapp.net',nom)
    on conflict(device_id,jid) do update set contact_id=excluded.contact_id,display_name=excluded.display_name
    returning id into resultado;
  return resultado;
end $$;

create or replace function public.crm_wa_cancel(p_command uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if not crm_wa_active() then return false; end if;
 update crm_wa_commands c set state='cancelled',result='Cancelado antes de enviarse.'
 where c.id=p_command and c.state='queued'
 and (c.requested_by=auth.uid() or exists(select 1 from crm_wa_devices d where d.id=c.device_id and d.owner_id=auth.uid() and crm_wa_manager()));
 get diagnostics n=row_count;
 return n=1;
end $$;

-- Verifica al solicitante sin modificar la privacidad existente de profiles.
create or replace function public.crm_wa_requester_active(p_command uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select crm_wa_manager() and exists(
  select 1 from crm_wa_commands c join crm_wa_devices d on d.id=c.device_id
  join profiles p on p.id=c.requested_by
  where c.id=p_command and d.owner_id=auth.uid() and p.active=true)
$$;

alter table public.crm_wa_devices enable row level security;
alter table public.crm_wa_pairings enable row level security;
alter table public.crm_wa_threads enable row level security;
alter table public.crm_wa_messages enable row level security;
alter table public.crm_wa_commands enable row level security;
alter table public.crm_wa_templates enable row level security;
alter table public.crm_wa_rules enable row level security;
alter table public.crm_wa_rule_runs enable row level security;

create policy wa_device_read on public.crm_wa_devices for select to authenticated using(crm_wa_active());
create policy wa_device_create on public.crm_wa_devices for insert to authenticated with check(crm_wa_manager() and owner_id=auth.uid());
create policy wa_device_update on public.crm_wa_devices for update to authenticated using(crm_wa_manager() and owner_id=auth.uid()) with check(crm_wa_manager() and owner_id=auth.uid());
create policy wa_pairing_owner on public.crm_wa_pairings for all to authenticated
 using(crm_wa_manager() and exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid()))
 with check(crm_wa_manager() and exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid()));
create policy wa_thread_read on public.crm_wa_threads for select to authenticated using(crm_wa_active());
create policy wa_thread_create on public.crm_wa_threads for insert to authenticated with check(crm_wa_active());
create policy wa_thread_update on public.crm_wa_threads for update to authenticated using(crm_wa_active()) with check(crm_wa_active());
create policy wa_message_read on public.crm_wa_messages for select to authenticated using(crm_wa_active());
create policy wa_message_create on public.crm_wa_messages for insert to authenticated
 with check(crm_wa_manager() and exists(select 1 from crm_wa_threads t join crm_wa_devices d on d.id=t.device_id where t.id=thread_id and d.owner_id=auth.uid()));
create policy wa_message_update on public.crm_wa_messages for update to authenticated
 using(crm_wa_manager() and exists(select 1 from crm_wa_threads t join crm_wa_devices d on d.id=t.device_id where t.id=thread_id and d.owner_id=auth.uid()))
 with check(crm_wa_manager() and exists(select 1 from crm_wa_threads t join crm_wa_devices d on d.id=t.device_id where t.id=thread_id and d.owner_id=auth.uid()));
create policy wa_command_read on public.crm_wa_commands for select to authenticated using(crm_wa_active());
create policy wa_command_create on public.crm_wa_commands for insert to authenticated with check(
 crm_wa_active() and requested_by=auth.uid() and state='queued' and
 (action='send' or exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid() and crm_wa_manager())));
create policy wa_command_update on public.crm_wa_commands for update to authenticated
 using(exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid() and crm_wa_manager()))
 with check(exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid() and crm_wa_manager()));
create policy wa_template_read on public.crm_wa_templates for select to authenticated using(crm_wa_active());
create policy wa_template_write on public.crm_wa_templates for all to authenticated using(crm_wa_manager()) with check(crm_wa_manager());
create policy wa_rule_read on public.crm_wa_rules for select to authenticated using(crm_wa_active());
create policy wa_rule_write on public.crm_wa_rules for all to authenticated
 using(crm_wa_manager() and exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid()))
 with check(crm_wa_manager() and exists(select 1 from crm_wa_devices d where d.id=device_id and d.owner_id=auth.uid()));
create policy wa_run_owner on public.crm_wa_rule_runs for all to authenticated
 using(crm_wa_manager() and exists(select 1 from crm_wa_threads t join crm_wa_devices d on d.id=t.device_id where t.id=thread_id and d.owner_id=auth.uid()))
 with check(crm_wa_manager() and exists(select 1 from crm_wa_threads t join crm_wa_devices d on d.id=t.device_id where t.id=thread_id and d.owner_id=auth.uid()));

revoke all on function public.crm_wa_active(), public.crm_wa_manager(), public.crm_wa_lease(uuid,uuid), public.crm_wa_claim(uuid,uuid), public.crm_wa_open_thread(uuid,uuid),public.crm_wa_cancel(uuid) from public,anon;
grant execute on function public.crm_wa_active(), public.crm_wa_manager(), public.crm_wa_lease(uuid,uuid), public.crm_wa_claim(uuid,uuid), public.crm_wa_open_thread(uuid,uuid),public.crm_wa_cancel(uuid) to authenticated;
revoke all on function public.crm_wa_requester_active(uuid) from public,anon;
grant execute on function public.crm_wa_requester_active(uuid) to authenticated;
grant select,insert,update on public.crm_wa_devices,public.crm_wa_threads,public.crm_wa_messages,public.crm_wa_commands to authenticated;
grant select,insert,update,delete on public.crm_wa_pairings,public.crm_wa_templates,public.crm_wa_rules,public.crm_wa_rule_runs to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('crm-wa-media','crm-wa-media',false,10485760,array['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','audio/wav','application/pdf']) on conflict(id) do nothing;
create policy wa_media_read on storage.objects for select to authenticated using(bucket_id='crm-wa-media' and public.crm_wa_active());
create policy wa_media_write on storage.objects for insert to authenticated with check(bucket_id='crm-wa-media' and public.crm_wa_manager());
create policy wa_media_assistant_upload on storage.objects for insert to authenticated with check(bucket_id='crm-wa-media' and public.crm_wa_active() and (storage.foldername(name))[1]='outgoing' and (storage.foldername(name))[2]=auth.uid()::text);
commit;
