create table if not exists users (
  username text primary key,
  password text not null,
  role text not null
);

create table if not exists posts (
  id uuid primary key,
  title text not null,
  content text not null default '',
  location text not null default '',
  topic text not null default '',
  media jsonb not null default '[]'::jsonb,
  likes jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  author text not null,
  "createdAt" bigint not null
);

create table if not exists travels (
  id uuid primary key,
  place text not null,
  country text not null default '',
  note text not null default '',
  lat double precision not null,
  lng double precision not null,
  date text not null default '',
  author text not null,
  "createdAt" bigint not null
);

create table if not exists comments (
  id uuid primary key,
  "postId" uuid not null,
  "parentId" uuid,
  author text not null,
  content text not null,
  "createdAt" bigint not null
);
