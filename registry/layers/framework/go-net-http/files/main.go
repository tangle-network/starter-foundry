package main

import (
	"log"
	"net/http"
	"os"

	"{{packageName}}/internal/app"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "{{port}}"
	}

	server := &http.Server{
		Addr:    "127.0.0.1:" + port,
		Handler: app.NewMux(),
	}

	log.Fatal(server.ListenAndServe())
}
