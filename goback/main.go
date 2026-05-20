package main

import (
	"log"
	"os"

	"github.com/Hamza-agha-tec/goback/db"
	"github.com/Hamza-agha-tec/goback/routes"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load .env file only if it exists (local dev only)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Connect to Supabase
	db.Connect()

	// Create Echo instance
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(middleware.Logger())  // logs every request
	e.Use(middleware.Recover()) // recovers from panics
	e.Use(middleware.CORS())    // allows cross-origin requests

	// Register all routes
	routes.SetupRoutes(e)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server running on http://localhost:%s", port)
	e.Logger.Fatal(e.Start(":" + port))
}
