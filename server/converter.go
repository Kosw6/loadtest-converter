package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ─── YAML scenario ────────────────────────────────────────────────────────────

func BuildScenarioYAML(req ConvertRequest) (string, error) {
	doc := buildScenarioDoc(req)
	out, err := yaml.Marshal(doc)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func buildScenarioDoc(req ConvertRequest) map[string]any {
	meta := map[string]any{
		"name":        req.Meta.Name,
		"description": req.Meta.Description,
	}

	var steps []map[string]any
	for _, s := range req.Steps {
		step := buildStep(s)
		steps = append(steps, step)
	}

	return map[string]any{
		"meta":  meta,
		"steps": steps,
	}
}

func buildStep(s StepInput) map[string]any {
	step := map[string]any{
		"id":   s.ID,
		"name": s.Name,
		"type": s.Type,
	}

	if len(s.DependsOn) > 0 {
		step["depends_on"] = s.DependsOn
	}

	switch s.Type {
	case "command":
		step["command"] = s.Command
		return step

	case "auth":
		step["base_url"] = s.BaseURL
		step["users"] = buildUsersBlock(s)
		return step

	case "final_check":
		step["base_url"] = s.BaseURL
		step["checks"] = buildChecksBlock(s.Checks)
		return step
	}

	// k6 step
	tmplPath := templatePath(s.Template)
	step["template"] = tmplPath
	step["flow"] = s.Flow
	step["base_url"] = s.BaseURL

	// 부하 방식에 따라 vus/duration/extra 결정
	switch s.LoadMode {
	case "total_requests":
		// shared-iterations: vus개 VU가 total_requests 횟수를 나눠 실행
		maxDur := s.MaxDuration
		if maxDur == "" {
			maxDur = "30s"
		}
		step["vus"] = s.VUs
		step["duration"] = maxDur
		step["extra"] = map[string]any{"total_requests": s.TotalRequests}
	case "burst":
		// shared-iterations: vus=total_requests → 최대 동시성
		maxDur := s.MaxDuration
		if maxDur == "" {
			maxDur = "10s"
		}
		step["vus"] = s.TotalRequests
		step["duration"] = maxDur
		step["extra"] = map[string]any{"total_requests": s.TotalRequests}
	default: // "rps" 또는 빈값 — 기존 동작
		step["vus"] = s.VUs
		step["duration"] = s.Duration
		if s.RPS > 0 {
			step["rps"] = s.RPS
		}
	}

	// users block
	usersBlock := buildUsersBlock(s)
	step["users"] = usersBlock

	// params block
	paramsBlock := buildParamsBlock(s)
	step["params"] = paramsBlock

	// actions
	var actions []map[string]any
	for _, a := range s.Actions {
		action := map[string]any{
			"id":     a.ID,
			"name":   a.Name,
			"method": strings.ToUpper(a.Method),
			"path":   a.Path,
		}
		if s.Flow == "weighted" {
			action["weight"] = a.Weight
		}
		if len(a.Headers) > 0 {
			action["headers"] = a.Headers
		}
		if len(a.Query) > 0 {
			action["query"] = a.Query
		}
		if len(a.Body) > 0 {
			action["body"] = a.Body
		}
		// extract
		if len(a.Extract.JSON) > 0 || len(a.Extract.Header) > 0 || len(a.Extract.Cookie) > 0 {
			extract := map[string]any{}
			if len(a.Extract.JSON) > 0 {
				extract["json"] = a.Extract.JSON
			}
			if len(a.Extract.Header) > 0 {
				extract["header"] = a.Extract.Header
			}
			if len(a.Extract.Cookie) > 0 {
				extract["cookie"] = a.Extract.Cookie
			}
			action["extract"] = extract
		}
		// assert
		if a.Assert.Status != 0 || len(a.Assert.JSON) > 0 {
			assert := map[string]any{}
			if a.Assert.Status != 0 {
				assert["status"] = a.Assert.Status
			}
			if len(a.Assert.JSON) > 0 {
				assert["json"] = a.Assert.JSON
			}
			action["assert"] = assert
		}
		actions = append(actions, action)
	}
	step["actions"] = actions

	return step
}

func buildChecksBlock(checks []FinalCheckInput) []map[string]any {
	var result []map[string]any
	for _, c := range checks {
		check := map[string]any{
			"id":     c.ID,
			"method": strings.ToUpper(c.Method),
			"path":   c.Path,
		}
		if len(c.Headers) > 0 {
			check["headers"] = c.Headers
		}
		if len(c.Body) > 0 {
			check["body"] = c.Body
		}
		// assert
		assert := map[string]any{}
		if c.Assert.Status != 0 {
			assert["status"] = c.Assert.Status
		}
		if len(c.Assert.JSON) > 0 {
			assert["json"] = c.Assert.JSON
		}
		if len(assert) > 0 {
			check["assert"] = assert
		}
		result = append(result, check)
	}
	return result
}

func buildUsersBlock(s StepInput) map[string]any {
	auth := map[string]any{
		"type": s.Users.AuthType,
	}

	if s.Users.AuthType == "login" {
		l := s.Users.Login
		method := l.Method
		if method == "" {
			method = "POST"
		}
		cookieName := l.CookieName
		if cookieName == "" {
			cookieName = "accessToken"
		}
		auth["request"] = map[string]any{
			"method": method,
			"url":    l.URL,
			"body":   l.Body,
		}
		auth["extract"] = map[string]any{
			"type": "cookie",
			"name": cookieName,
		}
		auth["apply"] = map[string]any{
			"type": "cookie",
			"name": cookieName,
		}

		// step별 usersData가 있으면 전용 CSV, 없으면 공용 users.csv
		usersFile := "../users.csv"
		if len(s.UsersData) > 0 {
			usersFile = fmt.Sprintf("../users/%s.csv", s.ID)
		}

		return map[string]any{
			"file":   usersFile,
			"key":    "userId",
			"assign": "round_robin",
			"auth":   auth,
		}
	}

	return map[string]any{
		"auth": auth,
	}
}

func buildParamsBlock(s StepInput) map[string]any {
	p := s.Params
	mode := p.Mode
	if mode == "" {
		mode = "rows"
	}
	strategy := p.Strategy
	if strategy == "" {
		strategy = "round_robin"
	}

	block := map[string]any{
		"mode":     mode,
		"strategy": strategy,
	}

	// paramsData가 있으면 무조건 파일 참조 (mode에 상관없이)
	if s.ParamsData != nil {
		block["file"] = fmt.Sprintf("../params/%s.json", s.ID)
		if p.UserKey != "" {
			block["user_key"] = p.UserKey
		}
	} else if mode == "per_user" {
		block["file"] = fmt.Sprintf("../params/%s.json", s.ID)
		if p.UserKey != "" {
			block["user_key"] = p.UserKey
		}
	}

	return block
}

func templatePath(template string) string {
	switch template {
	case "cookie_auth":
		return "templates/k6_http_actions_cookie_auth.js.tmpl"
	default:
		return "templates/k6_http_get_no_auth.js.tmpl"
	}
}

// ─── users.csv ────────────────────────────────────────────────────────────────

func BuildUsersCSV(users []UserRow) (string, error) {
	if len(users) == 0 {
		return "userId,loginId,password\n", nil
	}

	// collect headers from first row
	var headers []string
	for k := range users[0] {
		headers = append(headers, k)
	}

	var sb strings.Builder
	w := csv.NewWriter(&sb)

	if err := w.Write(headers); err != nil {
		return "", err
	}
	for _, row := range users {
		var vals []string
		for _, h := range headers {
			vals = append(vals, row[h])
		}
		if err := w.Write(vals); err != nil {
			return "", err
		}
	}
	w.Flush()
	return sb.String(), nil
}

// ─── params JSON ──────────────────────────────────────────────────────────────

func BuildParamsJSON(params ParamsInput) (string, error) {
	out, err := json.MarshalIndent(params, "", "  ")
	if err != nil {
		return "", err
	}
	return string(out), nil
}
