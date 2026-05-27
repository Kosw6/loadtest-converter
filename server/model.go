package main

// ─── Request ─────────────────────────────────────────────────────────────────

type ConvertRequest struct {
	Meta  MetaConfig  `json:"meta"`
	Infra InfraInput  `json:"infra"`
	Steps []StepInput `json:"steps"`
}

type InfraInput struct {
	Type    string           `json:"type"`    // docker-compose
	File    string           `json:"file"`    // docker-compose.yml 경로
	EnvFile string           `json:"envFile"` // .env.runtime 경로 (선택)
	Nodes   []InfraNodeInput `json:"nodes"`
}

type InfraNodeInput struct {
	ID        string `json:"id"`
	Container string `json:"container"`
}

type MetaConfig struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type StepInput struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`     // "k6" | "auth" | "final_check" | "command"
	DependsOn []string        `json:"dependsOn"`
	Flow      string          `json:"flow"`     // "sequential" | "weighted"
	Template  string          `json:"template"` // "no_auth" | "cookie_auth"
	BaseURL   string          `json:"baseUrl"`

	// ── 부하 방식 ─────────────────────────────────────────────────────────────
	// LoadMode: "rps" | "total_requests" | "burst"
	// rps (기본): VUs + Duration [+ RPS] → constant-arrival-rate or constant-vus
	// total_requests: TotalRequests + VUs + MaxDuration → shared-iterations
	// burst: TotalRequests + MaxDuration, vus=TotalRequests 자동 → shared-iterations
	LoadMode      string `json:"loadMode"`
	VUs           int    `json:"vus"`
	RPS           int    `json:"rps"`
	Duration      string `json:"duration"`
	TotalRequests int    `json:"totalRequests"` // total_requests / burst 모드
	MaxDuration   string `json:"maxDuration"`   // total_requests / burst 모드의 최대 허용 시간

	Actions   []ActionInput   `json:"actions"`
	Users     UsersInput      `json:"users"`
	UsersData []UserRow       `json:"usersData"`  // 이 step에서 쓸 user 행 데이터
	Params    ParamsStepInput `json:"params"`
	ParamsData *ParamsInput   `json:"paramsData"` // 이 step에서 쓸 params 데이터
	Command   string            `json:"command"`
	Checks    []FinalCheckInput `json:"checks"`  // final_check step 전용
	Target    string            `json:"target"`  // chaos step: infra node id
	Action    string            `json:"action"`  // chaos step: stop|start|restart|wait_healthy
}

type ActionInput struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Weight  int               `json:"weight"`
	Headers map[string]string `json:"headers"`
	Query   map[string]string `json:"query"`
	Body    map[string]any    `json:"body"`
	Extract ActionExtractInput `json:"extract"`
	Assert  ActionAssertInput  `json:"assert"`
}

type ActionExtractInput struct {
	JSON   map[string]string `json:"json"`
	Header map[string]string `json:"header"`
	Cookie map[string]string `json:"cookie"`
}

type ActionAssertInput struct {
	Status int               `json:"status"`
	JSON   map[string]string `json:"json"`
}

// FinalCheckInput는 final_check step 내 단건 HTTP 검증 설정
type FinalCheckInput struct {
	ID      string            `json:"id"`
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Headers map[string]string `json:"headers"`
	Body    map[string]any    `json:"body"`
	Assert  ActionAssertInput `json:"assert"`
}

type UsersInput struct {
	AuthType string    `json:"authType"` // "none" | "login"
	Login    LoginConf `json:"login"`
}

type LoginConf struct {
	URL        string            `json:"url"`
	Method     string            `json:"method"`
	Body       map[string]string `json:"body"`
	CookieName string            `json:"cookieName"`
}

type ParamsStepInput struct {
	Mode     string `json:"mode"`     // "rows" | "per_user"
	Strategy string `json:"strategy"` // "round_robin" | "random"
	UserKey  string `json:"userKey"`
}

// Global users/params tables
type UserRow map[string]string

type ParamsInput struct {
	Rows    []map[string]any            `json:"rows"`
	PerUser map[string][]map[string]any `json:"perUser"`
}

// ─── Response ─────────────────────────────────────────────────────────────────

type PreviewResponse struct {
	YAML string `json:"yaml"`
}
