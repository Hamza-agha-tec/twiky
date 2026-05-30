package db

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Connect() {
	dsn := os.Getenv("SUPABASE_DB_URL")

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}

	// ── Add these ──────────────────────────────
	DB.SetMaxOpenConns(25)                 // max simultaneous DB connections
	DB.SetMaxIdleConns(10)                 // keep 10 connections warm
	DB.SetConnMaxLifetime(5 * time.Minute) // recycle connections every 5 min
	DB.SetConnMaxIdleTime(1 * time.Minute) // drop idle connections after 1 min
	// ───────────────────────────────────────────

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to ping DB:", err)
	}

	// Automigrate tables
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS public.voice_events (
			id uuid NOT NULL DEFAULT gen_random_uuid(),
			group_id uuid NOT NULL,
			title text NOT NULL,
			description text,
			scheduled_start timestamp with time zone NOT NULL,
			scheduled_end timestamp with time zone,
			creator_id uuid NOT NULL,
			created_at timestamp with time zone NOT NULL DEFAULT now(),
			CONSTRAINT voice_events_pkey PRIMARY KEY (id),
			CONSTRAINT voice_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE,
			CONSTRAINT voice_events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS voice_events_group_id_idx ON public.voice_events(group_id);
	`)
	if err != nil {
		log.Println("⚠️ Failed to auto-create voice_events table:", err)
	} else {
		log.Println("✅ Verified/created voice_events table")
	}

	_, err = DB.Exec(`
		ALTER TABLE public.voice_events ADD COLUMN IF NOT EXISTS channel_id uuid;
		ALTER TABLE public.voice_events ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
		ALTER TABLE public.voice_events ADD COLUMN IF NOT EXISTS started_by uuid;
		UPDATE public.voice_events ve
		SET channel_id = g.channel_id
		FROM public.groups g
		WHERE ve.group_id = g.id AND ve.channel_id IS NULL;
	`)
	if err != nil {
		log.Println("⚠️ Failed to migrate voice_events columns:", err)
	} else {
		log.Println("✅ Verified voice_events started_at / channel_id columns")
	}

	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS public.subtasks (
			id uuid NOT NULL DEFAULT gen_random_uuid(),
			task_id uuid NOT NULL,
			title text NOT NULL,
			is_completed boolean NOT NULL DEFAULT false,
			created_at timestamp with time zone NOT NULL DEFAULT now(),
			CONSTRAINT subtasks_pkey PRIMARY KEY (id),
			CONSTRAINT subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON public.subtasks(task_id);
	`)
	if err != nil {
		log.Println("⚠️ Failed to auto-create subtasks table:", err)
	} else {
		log.Println("✅ Verified/created subtasks table")
	}

	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS public.task_comments (
			id uuid NOT NULL DEFAULT gen_random_uuid(),
			task_id uuid NOT NULL,
			user_id uuid NOT NULL,
			content text NOT NULL,
			parent_id uuid,
			reactions jsonb DEFAULT '[]'::jsonb,
			created_at timestamp with time zone NOT NULL DEFAULT now(),
			CONSTRAINT task_comments_pkey PRIMARY KEY (id),
			CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
			CONSTRAINT task_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
			CONSTRAINT task_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.task_comments(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS task_comments_task_id_idx ON public.task_comments(task_id);
	`)
	if err != nil {
		log.Println("⚠️ Failed to auto-create task_comments table:", err)
	} else {
		log.Println("✅ Verified/created task_comments table")
	}

	// Create project_join_requests table
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS public.project_join_requests (
			id uuid NOT NULL DEFAULT gen_random_uuid(),
			project_id uuid NOT NULL,
			user_id uuid NOT NULL,
			status text NOT NULL DEFAULT 'PENDING',
			message text,
			created_at timestamp with time zone NOT NULL DEFAULT now(),
			updated_at timestamp with time zone NOT NULL DEFAULT now(),
			CONSTRAINT project_join_requests_pkey PRIMARY KEY (id),
			CONSTRAINT project_join_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.workspace_projects(id) ON DELETE CASCADE,
			CONSTRAINT project_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
			CONSTRAINT project_join_requests_unique_pending UNIQUE (project_id, user_id, status) WHERE status = 'PENDING'
		);
		CREATE INDEX IF NOT EXISTS project_join_requests_project_id_idx ON public.project_join_requests(project_id);
	`)
	if err != nil {
		log.Println("⚠️ Failed to auto-create project_join_requests table:", err)
	} else {
		log.Println("✅ Verified/created project_join_requests table")
	}

	// Add is_pinned to notes if it doesn't exist
	_, err = DB.Exec(`
		ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
	`)
	if err != nil {
		log.Println("⚠️ Failed to migrate notes is_pinned column:", err)
	} else {
		log.Println("✅ Verified notes is_pinned column")
	}

	log.Println("✅ Connected to Supabase DB")
}
