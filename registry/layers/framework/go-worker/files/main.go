package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("[{{serviceName}}] worker booting")
	fmt.Println("cycle complete", time.Now().Unix())
}
