package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
)

// POST /api/convert/preview  → { yaml: "..." }
func handlePreview(w http.ResponseWriter, r *http.Request) {
	var req ConvertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	yamlStr, err := BuildScenarioYAML(req)
	if err != nil {
		http.Error(w, "yaml build failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PreviewResponse{YAML: yamlStr})
}

// POST /api/convert/export → ZIP download
func handleExport(w http.ResponseWriter, r *http.Request) {
	var req ConvertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	buf, err := buildZip(req)
	if err != nil {
		http.Error(w, "zip build failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	name := req.Meta.Name
	if name == "" {
		name = "scenario"
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`.zip"`)
	w.Write(buf.Bytes())
}

func buildZip(req ConvertRequest) (*bytes.Buffer, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)
	defer zw.Close()

	// scenario.yml
	yamlStr, err := BuildScenarioYAML(req)
	if err != nil {
		return nil, err
	}
	if err := addFile(zw, "scenario.yml", []byte(yamlStr)); err != nil {
		return nil, err
	}

	// step별 users CSV / params JSON
	for _, step := range req.Steps {
		// users CSV: k6 또는 auth step 모두 포함
		if (step.Type == "k6" || step.Type == "auth") && len(step.UsersData) > 0 {
			csvStr, err := BuildUsersCSV(step.UsersData)
			if err != nil {
				return nil, err
			}
			csvPath := fmt.Sprintf("users/%s.csv", step.ID)
			if err := addFile(zw, csvPath, []byte(csvStr)); err != nil {
				return nil, err
			}
		}

		// params JSON: k6 step만
		if step.Type == "k6" && step.ParamsData != nil {
			paramsStr, err := BuildParamsJSON(*step.ParamsData)
			if err != nil {
				return nil, err
			}
			paramsPath := fmt.Sprintf("params/%s.json", step.ID)
			if err := addFile(zw, paramsPath, []byte(paramsStr)); err != nil {
				return nil, err
			}
		}
	}

	// templates (embed)
	if err := addEmbeddedTemplates(zw); err != nil {
		return nil, err
	}

	return buf, nil
}

func addFile(zw *zip.Writer, name string, data []byte) error {
	f, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	return err
}

func addEmbeddedTemplates(zw *zip.Writer) error {
	return fs.WalkDir(embeddedTemplates, "embed/templates", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}

		// strip "embed/" prefix so zip has "templates/..."
		zipPath := path[len("embed/"):]

		f, err := zw.Create(zipPath)
		if err != nil {
			return err
		}

		src, err := embeddedTemplates.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()

		_, err = io.Copy(f, src)
		return err
	})
}

// POST /api/convert/import → { meta, steps } (ConvertRequest)
func handleImport(w http.ResponseWriter, r *http.Request) {
	var body struct {
		YAML string `json:"yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	req, err := ImportScenario(body.YAML)
	if err != nil {
		http.Error(w, "yaml import failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}
