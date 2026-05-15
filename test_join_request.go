package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/nedpals/supabase-go"
)

type TestGroup struct {
	ID         string `json:"id"`
	AccessType string `json:"access_type"`
	ChannelID  string `json:"channel_id"`
}

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Fatal("Error loading .env file")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	client := supabase.CreateClient(supabaseURL, supabaseKey)

	groupID := "eda2ed72-27fe-4d1a-a6d1-bbee7af4fd1b"

	// Fixed: separate args
	fmt.Println("=== Select with separate args (FIXED) ===")
	var groups []TestGroup
	err := client.DB.From("groups").
		Select("access_type", "channel_id").
		Filter("id", "eq", groupID).
		Execute(&groups)

	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		fmt.Printf("OK: got %d groups: %+v\n", len(groups), groups)
	}
}
