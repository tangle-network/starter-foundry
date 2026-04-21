// Minimal Celestia DA client — submits a blob to the local light node and
// retrieves it at the included height via the JSON-RPC interface.
//
// Run:   go run ./cmd/client
// Needs: CELESTIA_NODE_AUTH_TOKEN env (see AGENTS.md) and the node running on :26658
package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	rpcURL      = "http://127.0.0.1:26658"
	namespace   = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZGE="
	httpTimeout = 30 * time.Second
)

type rpcReq struct {
	Jsonrpc string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
}

type submitResp struct {
	Result uint64 `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type blob struct {
	Namespace    string `json:"namespace"`
	Data         string `json:"data"`
	ShareVersion int    `json:"share_version"`
	Commitment   string `json:"commitment,omitempty"`
}

type getAllResp struct {
	Result []blob `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func main() {
	token := os.Getenv("CELESTIA_NODE_AUTH_TOKEN")
	if token == "" {
		fmt.Fprintln(os.Stderr, "set CELESTIA_NODE_AUTH_TOKEN (docker compose exec node celestia light auth admin --p2p.network mocha-4)")
		os.Exit(1)
	}

	client := &http.Client{Timeout: httpTimeout}
	payload := []byte("hello from celestia-da")
	height, err := submitBlob(client, token, payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "submit: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("submitted: included at height %d\n", height)

	blobs, err := getAllBlobs(client, token, height)
	if err != nil {
		fmt.Fprintf(os.Stderr, "retrieve: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("retrieved: %d blob(s) at height %d\n", len(blobs), height)
	for i, b := range blobs {
		raw, _ := base64.StdEncoding.DecodeString(b.Data)
		fmt.Printf("  [%d] commitment=%s bytes=%q\n", i, b.Commitment, string(raw))
	}
}

func submitBlob(client *http.Client, token string, data []byte) (uint64, error) {
	b := blob{
		Namespace:    namespace,
		Data:         base64.StdEncoding.EncodeToString(data),
		ShareVersion: 0,
	}
	req := rpcReq{
		Jsonrpc: "2.0",
		ID:      1,
		Method:  "blob.Submit",
		Params:  []any{[]blob{b}, map[string]float64{"gas_price": 0.002}},
	}
	var out submitResp
	if err := call(client, token, req, &out); err != nil {
		return 0, err
	}
	if out.Error != nil {
		return 0, fmt.Errorf("rpc error %d: %s", out.Error.Code, out.Error.Message)
	}
	return out.Result, nil
}

func getAllBlobs(client *http.Client, token string, height uint64) ([]blob, error) {
	req := rpcReq{
		Jsonrpc: "2.0",
		ID:      2,
		Method:  "blob.GetAll",
		Params:  []any{height, []string{namespace}},
	}
	var out getAllResp
	if err := call(client, token, req, &out); err != nil {
		return nil, err
	}
	if out.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", out.Error.Code, out.Error.Message)
	}
	return out.Result, nil
}

func call(client *http.Client, token string, req rpcReq, out any) error {
	body, err := json.Marshal(req)
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequest("POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("http %d: %s", resp.StatusCode, string(raw))
	}
	return json.Unmarshal(raw, out)
}
