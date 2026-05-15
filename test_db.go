package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	dbURL := os.Getenv("SUPABASE_DB_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres.qmdfqlvsrpebevswmugt:XBSvrlAfJNGdjrMx@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
	}
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_name = 'group_join_requests';
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Columns for group_join_requests:")
	for rows.Next() {
		var colName, dataType string
		if err := rows.Scan(&colName, &dataType); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("- %s: %s\n", colName, dataType)
	}

	fmt.Println("\nColumns for channel_members:")
	rows2, err := db.Query(`
		SELECT column_name, data_type 
		FROM information_schema.columns 
		WHERE table_name = 'channel_members';
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var colName, dataType string
		if err := rows2.Scan(&colName, &dataType); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("- %s: %s\n", colName, dataType)
	}
}
