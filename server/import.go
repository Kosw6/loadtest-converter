package main

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ── YAML 파싱용 내부 구조체 ────────────────────────────────────────────────────

type yamlScenario struct {
	// 최상위 레벨 name/description (튜토리얼 시나리오 형식)
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	// meta 블록 (컨버터 생성 형식)
	Meta struct {
		Name        string `yaml:"name"`
		Description string `yaml:"description"`
	} `yaml:"meta"`
	Infra struct {
		Type    string `yaml:"type"`
		File    string `yaml:"file"`
		EnvFile string `yaml:"env_file"`
		Nodes   []struct {
			ID        string `yaml:"id"`
			Container string `yaml:"container"`
		} `yaml:"nodes"`
	} `yaml:"infra"`
	Steps []yamlStep `yaml:"steps"`
}

type yamlStep struct {
	ID        string            `yaml:"id"`
	Name      string            `yaml:"name"`
	Type      string            `yaml:"type"`
	DependsOn []string          `yaml:"depends_on"`
	Command   string            `yaml:"command"`
	BaseURL   string            `yaml:"base_url"`
	Flow      string            `yaml:"flow"`
	Template  string            `yaml:"template"`
	VUs       int               `yaml:"vus"`
	RPS       int               `yaml:"rps"`
	Duration  string            `yaml:"duration"`
	Extra     map[string]any    `yaml:"extra"` // total_requests 등 부하 방식 확장 필드
	Users     yamlUsers         `yaml:"users"`
	Params    yamlParams        `yaml:"params"`
	Actions   []yamlAction      `yaml:"actions"`
	Endpoints []yamlEndpoint    `yaml:"endpoints"` // 구버전 호환
	Checks    []yamlCheck       `yaml:"checks"`
	Target    string            `yaml:"target"`
	Action    string            `yaml:"action"`
}

// yamlEndpoint는 구버전 scenario.yml의 endpoints 필드 (actions로 변환)
type yamlEndpoint struct {
	Key     string            `yaml:"key"`
	Name    string            `yaml:"name"`
	Method  string            `yaml:"method"`
	Path    string            `yaml:"path"`
	Weight  int               `yaml:"weight"`
	Headers map[string]string `yaml:"headers"`
	Query   map[string]string `yaml:"query"`
	Body    map[string]any    `yaml:"body"`
}

type yamlUsers struct {
	File   string   `yaml:"file"`
	Key    string   `yaml:"key"`
	Assign string   `yaml:"assign"`
	Auth   yamlAuth `yaml:"auth"`
}

type yamlAuth struct {
	Type    string          `yaml:"type"`
	Request yamlAuthRequest `yaml:"request"`
	Extract yamlAuthExtract `yaml:"extract"`
	Apply   yamlAuthApply   `yaml:"apply"`
}

type yamlAuthRequest struct {
	Method  string            `yaml:"method"`
	URL     string            `yaml:"url"`
	Headers map[string]string `yaml:"headers"`
	Body    map[string]string `yaml:"body"`
}

type yamlAuthExtract struct {
	Type string `yaml:"type"`
	Name string `yaml:"name"`
	Path string `yaml:"path"`
}

type yamlAuthApply struct {
	Type   string `yaml:"type"`
	Header string `yaml:"header"`
	Name   string `yaml:"name"`
}

type yamlParams struct {
	File     string `yaml:"file"`
	Mode     string `yaml:"mode"`
	Strategy string `yaml:"strategy"`
	UserKey  string `yaml:"user_key"`
}

type yamlAction struct {
	ID      string            `yaml:"id"`
	Name    string            `yaml:"name"`
	Method  string            `yaml:"method"`
	Path    string            `yaml:"path"`
	Weight  int               `yaml:"weight"`
	Headers map[string]string `yaml:"headers"`
	Query   map[string]string `yaml:"query"`
	Body    map[string]any    `yaml:"body"`
	Extract yamlExtract       `yaml:"extract"`
	Assert  yamlAssert        `yaml:"assert"`
}

type yamlExtract struct {
	JSON   map[string]string `yaml:"json"`
	Header map[string]string `yaml:"header"`
	Cookie map[string]string `yaml:"cookie"`
}

type yamlAssert struct {
	Status int               `yaml:"status"`
	JSON   map[string]string `yaml:"json"`
}

type yamlCheck struct {
	ID      string            `yaml:"id"`
	Method  string            `yaml:"method"`
	Path    string            `yaml:"path"`
	Headers map[string]string `yaml:"headers"`
	Body    map[string]any    `yaml:"body"`
	Assert  yamlAssert        `yaml:"assert"`
}

// ── ImportScenario: YAML 문자열 → ConvertRequest ──────────────────────────────

func ImportScenario(yamlStr string) (ConvertRequest, error) {
	var doc yamlScenario
	if err := yaml.Unmarshal([]byte(yamlStr), &doc); err != nil {
		return ConvertRequest{}, fmt.Errorf("YAML 파싱 실패: %w", err)
	}

	// meta 블록 우선, 없으면 최상위 레벨 name/description 폴백
	metaName := doc.Meta.Name
	if metaName == "" {
		metaName = doc.Name
	}
	metaDesc := doc.Meta.Description
	if metaDesc == "" {
		metaDesc = doc.Description
	}

	req := ConvertRequest{
		Meta: MetaConfig{
			Name:        metaName,
			Description: metaDesc,
		},
		Infra: InfraInput{
			Type:    doc.Infra.Type,
			File:    doc.Infra.File,
			EnvFile: doc.Infra.EnvFile,
		},
	}

	for _, n := range doc.Infra.Nodes {
		req.Infra.Nodes = append(req.Infra.Nodes, InfraNodeInput{
			ID:        n.ID,
			Container: n.Container,
		})
	}

	for _, s := range doc.Steps {
		req.Steps = append(req.Steps, convertYAMLStep(s))
	}

	return req, nil
}

func convertYAMLStep(s yamlStep) StepInput {
	authType := s.Users.Auth.Type
	if authType == "" {
		authType = "none"
	}

	flow := s.Flow
	// 구버전 flow: endpoints → sequential
	if flow == "" || flow == "endpoints" {
		flow = "sequential"
	}

	// extra.total_requests 가 있으면 total_requests / burst 모드로 복원
	loadMode := "rps"
	totalRequests := 0
	maxDuration := ""
	duration := s.Duration
	vus := s.VUs
	if s.Extra != nil {
		if raw, ok := s.Extra["total_requests"]; ok {
			var n int
			switch v := raw.(type) {
			case int:
				n = v
			case float64:
				n = int(v)
			}
			if n > 0 {
				totalRequests = n
				maxDuration = s.Duration
				duration = ""
				if s.VUs == n {
					loadMode = "burst"
				} else {
					loadMode = "total_requests"
				}
			}
		}
	}

	step := StepInput{
		ID:            s.ID,
		Name:          s.Name,
		Type:          s.Type,
		DependsOn:     s.DependsOn,
		Command:       s.Command,
		Target:        s.Target,
		Action:        s.Action,
		BaseURL:       s.BaseURL,
		Flow:          flow,
		Template:      reverseTemplatePath(s.Template),
		LoadMode:      loadMode,
		VUs:           vus,
		RPS:           s.RPS,
		Duration:      duration,
		TotalRequests: totalRequests,
		MaxDuration:   maxDuration,
		Users: UsersInput{
			AuthType: authType,
			Login: LoginConf{
				URL:        s.Users.Auth.Request.URL,
				Method:     s.Users.Auth.Request.Method,
				Body:       s.Users.Auth.Request.Body,
				CookieName: s.Users.Auth.Extract.Name,
			},
		},
		Params: ParamsStepInput{
			Mode:     s.Params.Mode,
			Strategy: s.Params.Strategy,
			UserKey:  s.Params.UserKey,
		},
	}

	// actions (신버전)
	for _, a := range s.Actions {
		step.Actions = append(step.Actions, ActionInput{
			ID:      a.ID,
			Name:    a.Name,
			Method:  a.Method,
			Path:    a.Path,
			Weight:  a.Weight,
			Headers: nonNilStrMap(a.Headers),
			Query:   nonNilStrMap(a.Query),
			Body:    nonNilAnyMap(a.Body),
			Extract: ActionExtractInput{
				JSON:   nonNilStrMap(a.Extract.JSON),
				Header: nonNilStrMap(a.Extract.Header),
				Cookie: nonNilStrMap(a.Extract.Cookie),
			},
			Assert: ActionAssertInput{
				Status: a.Assert.Status,
				JSON:   nonNilStrMap(a.Assert.JSON),
			},
		})
	}

	// endpoints → actions 변환 (구버전 호환)
	for _, e := range s.Endpoints {
		id := e.Key
		if id == "" {
			id = e.Name
		}
		step.Actions = append(step.Actions, ActionInput{
			ID:      id,
			Name:    e.Name,
			Method:  e.Method,
			Path:    e.Path,
			Weight:  e.Weight,
			Headers: nonNilStrMap(e.Headers),
			Query:   nonNilStrMap(e.Query),
			Body:    nonNilAnyMap(e.Body),
			Extract: ActionExtractInput{
				JSON:   map[string]string{},
				Header: map[string]string{},
				Cookie: map[string]string{},
			},
			Assert: ActionAssertInput{
				JSON: map[string]string{},
			},
		})
	}

	// nil 슬라이스 → 빈 슬라이스 (JSON null 방지)
	if step.Actions == nil {
		step.Actions = []ActionInput{}
	}
	if step.Checks == nil {
		step.Checks = []FinalCheckInput{}
	}

	// checks (final_check step)
	for _, c := range s.Checks {
		step.Checks = append(step.Checks, FinalCheckInput{
			ID:      c.ID,
			Method:  c.Method,
			Path:    c.Path,
			Headers: nonNilStrMap(c.Headers),
			Body:    nonNilAnyMap(c.Body),
			Assert: ActionAssertInput{
				Status: c.Assert.Status,
				JSON:   nonNilStrMap(c.Assert.JSON),
			},
		})
	}

	return step
}

// reverseTemplatePath: 파일 경로 → UI 템플릿 키
func reverseTemplatePath(path string) string {
	if strings.Contains(path, "cookie_auth") {
		return "cookie_auth"
	}
	return "no_auth"
}

// nil 맵을 빈 맵으로 변환 — JSON null 직렬화 방지용 헬퍼
func nonNilStrMap(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

func nonNilAnyMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}
