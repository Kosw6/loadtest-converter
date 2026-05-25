package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/rs/cors"
)

//go:embed embed/templates
var embeddedTemplates embed.FS

func main() {
	// Render가 PORT를 자동 할당하므로 env에서 읽음
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/convert/preview", handlePreview)
	mux.HandleFunc("POST /api/convert/export", handleExport)
	mux.HandleFunc("POST /api/convert/import", handleImport)

	// 공개 변환 API — 모든 Origin 허용 (stateless, 민감 데이터 없음)
	c := cors.New(cors.Options{
		AllowAllOrigins: true,
		AllowedMethods:  []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:  []string{"Content-Type"},
	})

	handler := c.Handler(mux)

	fmt.Printf("loadtest-converter server running on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
