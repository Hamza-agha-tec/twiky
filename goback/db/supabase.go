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

	log.Println("✅ Connected to Supabase DB")
}
