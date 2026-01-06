CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    configuration jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    avatar_url text,
    preferred_language text DEFAULT 'en'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    artist text,
    original_file_url text,
    duration double precision,
    bpm integer,
    key text,
    genre text,
    status text DEFAULT 'uploaded'::text,
    separation_config jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'configuring'::text, 'processing'::text, 'completed'::text, 'error'::text])))
);


--
-- Name: shared_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    shared_by uuid NOT NULL,
    shared_with uuid NOT NULL,
    permission text DEFAULT 'view'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shared_projects_permission_check CHECK ((permission = ANY (ARRAY['view'::text, 'edit'::text])))
);


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    file_url text,
    waveform_data jsonb,
    volume double precision DEFAULT 1.0,
    pan double precision DEFAULT 0.0,
    is_muted boolean DEFAULT false,
    is_solo boolean DEFAULT false,
    order_index integer DEFAULT 0,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tracks_type_check CHECK ((type = ANY (ARRAY['vocals'::text, 'drums'::text, 'bass'::text, 'guitar'::text, 'piano'::text, 'synth'::text, 'strings'::text, 'winds'::text, 'other'::text, 'instrumental'::text, 'dialogue'::text, 'effects'::text, 'music'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: presets presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presets
    ADD CONSTRAINT presets_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: shared_projects shared_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_projects
    ADD CONSTRAINT shared_projects_pkey PRIMARY KEY (id);


--
-- Name: shared_projects shared_projects_project_id_shared_with_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_projects
    ADD CONSTRAINT shared_projects_project_id_shared_with_key UNIQUE (project_id, shared_with);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: presets presets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presets
    ADD CONSTRAINT presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_projects shared_projects_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_projects
    ADD CONSTRAINT shared_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: shared_projects shared_projects_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_projects
    ADD CONSTRAINT shared_projects_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_projects shared_projects_shared_with_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_projects
    ADD CONSTRAINT shared_projects_shared_with_fkey FOREIGN KEY (shared_with) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tracks tracks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: presets Users can delete own presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own presets" ON public.presets FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: projects Users can delete own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: shared_projects Users can delete shares they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete shares they created" ON public.shared_projects FOR DELETE USING ((auth.uid() = shared_by));


--
-- Name: tracks Users can delete tracks from own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tracks from own projects" ON public.tracks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tracks.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: presets Users can insert own presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own presets" ON public.presets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: projects Users can insert own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: tracks Users can insert tracks to own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tracks to own projects" ON public.tracks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tracks.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: shared_projects Users can share own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can share own projects" ON public.shared_projects FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = shared_projects.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: presets Users can update own presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own presets" ON public.presets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: projects Users can update own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tracks Users can update tracks in own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tracks in own projects" ON public.tracks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tracks.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: presets Users can view own presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own presets" ON public.presets FOR SELECT USING (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: projects Users can view own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: projects Users can view shared projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view shared projects" ON public.projects FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.shared_projects
  WHERE ((shared_projects.project_id = shared_projects.id) AND (shared_projects.shared_with = auth.uid())))));


--
-- Name: shared_projects Users can view shares they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view shares they created" ON public.shared_projects FOR SELECT USING ((auth.uid() = shared_by));


--
-- Name: shared_projects Users can view shares with them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view shares with them" ON public.shared_projects FOR SELECT USING ((auth.uid() = shared_with));


--
-- Name: tracks Users can view tracks from own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tracks from own projects" ON public.tracks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = tracks.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: tracks Users can view tracks from shared projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tracks from shared projects" ON public.tracks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.shared_projects sp
     JOIN public.projects p ON ((sp.project_id = p.id)))
  WHERE ((p.id = sp.project_id) AND (sp.shared_with = auth.uid())))));


--
-- Name: presets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;