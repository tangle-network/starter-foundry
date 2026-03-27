package app

import (
	"encoding/json"
	"net/http"
	"os"
)

type healthPayload struct {
	Status   string `json:"status"`
	Service  string `json:"service"`
	Database string `json:"database"`
	SDK      string `json:"sdk"`
}

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(writer).Encode(healthPayload{
			Status:   "ok",
			Service:  "{{serviceName}}",
			Database: "{{databaseProvider}}",
			SDK:      os.Getenv("SDK_PROVIDER"),
		})
	})
	return mux
}
