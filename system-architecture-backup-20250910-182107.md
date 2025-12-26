# NSG Tool System Architecture with AI-Powered Remediation

## Enhanced System Design with OpenAI & AutoGen Integration

```mermaid
graph TB
    %% Frontend Layer
    subgraph "Frontend (React + Vite)"
        UI["User Interface"]
        subgraph "Pages"
            RP["Reports Page"]
            HP["Home Page"]
            SP["Settings Page"]
            RP_NEW["Remediation Dashboard"]
        end
        subgraph "Components"
            RT["Reports Table"]
            EM["Email Modal"]
            RB["Run Now Button"]
            SC["Schedule Component"]
            RC["Remediation Console"]
            AC["Agent Status Panel"]
        end
    end

    %% Backend Layer
    subgraph "Backend (Python HTTP Server)"
        API["API Router"]
        subgraph "Core Services"
            NSG["NSG Validation Service"]
            ASG["ASG Validation Service"]
            ES["Email Service"]
            SS["Scheduler Service"]
        end
        subgraph "AI Remediation Layer"
            ARM["Agent Remediation Manager"]
            OAI["OpenAI Integration"]
            AG["AutoGen Multi-Agent System"]
            subgraph "Specialized Agents"
                NSG_AGENT["NSG Remediation Agent"]
                ASG_AGENT["ASG Remediation Agent"]
                COORD_AGENT["Coordinator Agent"]
                EXEC_AGENT["Execution Agent"]
            end
        end
        subgraph "Data Storage"
            MEM["In-Memory Storage"]
            FS["File System"]
            LOGS["Logging System"]
            AGENT_STATE["Agent State Store"]
        end
    end

    %% External Services
    subgraph "External Services"
        AZURE["Azure API"]
        SMTP["SMTP Server"]
        OPENAI_API["OpenAI API"]
    end

    %% Data Flow
    UI --> API
    RP --> RT
    RP --> EM
    RP_NEW --> RC
    RP_NEW --> AC
    RT --> RB
    EM --> SC
    
    API --> NSG
    API --> ASG
    API --> ES
    API --> SS
    API --> ARM
    
    ARM --> OAI
    ARM --> AG
    OAI --> OPENAI_API
    
    AG --> NSG_AGENT
    AG --> ASG_AGENT
    AG --> COORD_AGENT
    AG --> EXEC_AGENT
    
    NSG_AGENT --> AZURE
    ASG_AGENT --> AZURE
    EXEC_AGENT --> AZURE
    
    NSG --> AZURE
    ASG --> AZURE
    ES --> SMTP
    
    NSG --> MEM
    ASG --> MEM
    SS --> MEM
    ARM --> AGENT_STATE
    
    API --> FS
    API --> LOGS

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef external fill:#fff3e0
    classDef storage fill:#e8f5e8
    classDef ai fill:#fce4ec
    classDef agent fill:#e8f5e8
    
    class UI,RP,HP,SP,RP_NEW,RT,EM,RB,SC,RC,AC frontend
    class API,NSG,ASG,ES,SS backend
    class AZURE,SMTP,OPENAI_API external
    class MEM,FS,LOGS,AGENT_STATE storage
    class ARM,OAI,AG ai
    class NSG_AGENT,ASG_AGENT,COORD_AGENT,EXEC_AGENT agent
```

## AI-Powered Remediation Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as Backend API
    participant ARM as Agent Remediation Manager
    participant COORD as Coordinator Agent
    participant NSG_A as NSG Agent
    participant ASG_A as ASG Agent
    participant EXEC as Execution Agent
    participant OAI as OpenAI API
    participant AZURE as Azure API

    %% Issue Detection
    U->>F: View Validation Report
    F->>API: GET /api/v1/reports/validation
    API->>AZURE: Fetch NSG/ASG Data
    AZURE-->>API: Validation Results with Issues
    API-->>F: Issues Detected
    F-->>U: Display Issues + "Auto-Remediate" Button

    %% Remediation Initiation
    U->>F: Click "Auto-Remediate"
    F->>API: POST /api/v1/remediation/start
    API->>ARM: Initialize Remediation Session
    ARM->>COORD: Create Agent Team
    
    %% Agent Coordination
    COORD->>OAI: Analyze Issues Context
    OAI-->>COORD: Issue Analysis & Strategy
    COORD->>NSG_A: Assign NSG Issues
    COORD->>ASG_A: Assign ASG Issues
    
    %% Parallel Agent Processing
    par NSG Remediation
        NSG_A->>OAI: Generate NSG Fix Strategy
        OAI-->>NSG_A: Remediation Plan
        NSG_A->>EXEC: Request NSG Rule Updates
    and ASG Remediation
        ASG_A->>OAI: Generate ASG Fix Strategy
        OAI-->>ASG_A: Remediation Plan
        ASG_A->>EXEC: Request ASG Policy Updates
    end
    
    %% Execution Phase
    EXEC->>AZURE: Apply NSG Rule Changes
    EXEC->>AZURE: Apply ASG Policy Changes
    AZURE-->>EXEC: Execution Results
    
    %% Validation & Reporting
    EXEC->>COORD: Report Execution Status
    COORD->>ARM: Consolidate Results
    ARM->>API: Remediation Complete
    API-->>F: Success/Failure Report
    F-->>U: Display Remediation Results
```

## AutoGen Multi-Agent System Architecture

```mermaid
graph TD
    subgraph "AutoGen Agent Framework"
        subgraph "Agent Roles"
            COORD["🎯 Coordinator Agent<br/>- Issue triage<br/>- Task delegation<br/>- Progress monitoring"]
            NSG_AGENT["🛡️ NSG Specialist Agent<br/>- NSG rule analysis<br/>- Security policy expertise<br/>- Rule optimization"]
            ASG_AGENT["⚖️ ASG Specialist Agent<br/>- ASG policy analysis<br/>- Compliance checking<br/>- Policy remediation"]
            EXEC_AGENT["⚡ Execution Agent<br/>- Azure API calls<br/>- Change implementation<br/>- Rollback capability"]
            REVIEW_AGENT["🔍 Review Agent<br/>- Change validation<br/>- Risk assessment<br/>- Approval workflow"]
        end
        
        subgraph "Agent Communication"
            MSG_BUS["Message Bus"]
            STATE_MGR["State Manager"]
            TASK_QUEUE["Task Queue"]
        end
        
        subgraph "OpenAI Integration"
            GPT4["GPT-4 Turbo<br/>Strategic Planning"]
            GPT35["GPT-3.5 Turbo<br/>Code Generation"]
            EMBEDDINGS["Text Embeddings<br/>Knowledge Retrieval"]
        end
    end
    
    %% Agent Interactions
    COORD --> NSG_AGENT
    COORD --> ASG_AGENT
    NSG_AGENT --> EXEC_AGENT
    ASG_AGENT --> EXEC_AGENT
    EXEC_AGENT --> REVIEW_AGENT
    REVIEW_AGENT --> COORD
    
    %% Communication Layer
    COORD <--> MSG_BUS
    NSG_AGENT <--> MSG_BUS
    ASG_AGENT <--> MSG_BUS
    EXEC_AGENT <--> MSG_BUS
    REVIEW_AGENT <--> MSG_BUS
    
    MSG_BUS <--> STATE_MGR
    MSG_BUS <--> TASK_QUEUE
    
    %% OpenAI Integration
    COORD --> GPT4
    NSG_AGENT --> GPT35
    ASG_AGENT --> GPT35
    REVIEW_AGENT --> GPT4
    
    NSG_AGENT --> EMBEDDINGS
    ASG_AGENT --> EMBEDDINGS
    
    classDef agent fill:#e3f2fd
    classDef communication fill:#f1f8e9
    classDef ai fill:#fce4ec
    
    class COORD,NSG_AGENT,ASG_AGENT,EXEC_AGENT,REVIEW_AGENT agent
    class MSG_BUS,STATE_MGR,TASK_QUEUE communication
    class GPT4,GPT35,EMBEDDINGS ai
```

## Remediation Decision Tree

```mermaid
flowchart TD
    START(["Validation Issue Detected"])
    ANALYZE{"Issue Analysis"}
    
    NSG_ISSUE["NSG Rule Issue"]
    ASG_ISSUE["ASG Policy Issue"]
    COMPLEX_ISSUE["Complex Multi-Service Issue"]
    
    %% NSG Path
    NSG_TYPE{"NSG Issue Type"}
    NSG_MISSING["Missing Rule"]
    NSG_OVERPERM["Over-Permissive Rule"]
    NSG_CONFLICT["Rule Conflict"]
    
    NSG_AUTO_FIX["🤖 Auto-Generate Rule"]
    NSG_RESTRICT["🔒 Apply Restrictions"]
    NSG_RESOLVE["⚖️ Resolve Conflicts"]
    
    %% ASG Path
    ASG_TYPE{"ASG Issue Type"}
    ASG_POLICY["Policy Violation"]
    ASG_COMPLIANCE["Compliance Issue"]
    ASG_CONFIG["Configuration Error"]
    
    ASG_UPDATE["📋 Update Policy"]
    ASG_COMPLY["✅ Apply Compliance"]
    ASG_RECONFIG["⚙️ Fix Configuration"]
    
    %% Complex Path
    MULTI_AGENT["🎯 Multi-Agent Coordination"]
    STRATEGY["📊 Generate Strategy"]
    PARALLEL["⚡ Parallel Execution"]
    
    %% Execution
    VALIDATE{"Pre-execution Validation"}
    EXECUTE["🚀 Execute Changes"]
    VERIFY["✓ Verify Results"]
    ROLLBACK["↩️ Rollback if Failed"]
    SUCCESS(["✅ Remediation Complete"])
    FAILURE(["❌ Manual Intervention Required"])
    
    START --> ANALYZE
    ANALYZE --> NSG_ISSUE
    ANALYZE --> ASG_ISSUE
    ANALYZE --> COMPLEX_ISSUE
    
    NSG_ISSUE --> NSG_TYPE
    NSG_TYPE --> NSG_MISSING
    NSG_TYPE --> NSG_OVERPERM
    NSG_TYPE --> NSG_CONFLICT
    
    NSG_MISSING --> NSG_AUTO_FIX
    NSG_OVERPERM --> NSG_RESTRICT
    NSG_CONFLICT --> NSG_RESOLVE
    
    ASG_ISSUE --> ASG_TYPE
    ASG_TYPE --> ASG_POLICY
    ASG_TYPE --> ASG_COMPLIANCE
    ASG_TYPE --> ASG_CONFIG
    
    ASG_POLICY --> ASG_UPDATE
    ASG_COMPLIANCE --> ASG_COMPLY
    ASG_CONFIG --> ASG_RECONFIG
    
    COMPLEX_ISSUE --> MULTI_AGENT
    MULTI_AGENT --> STRATEGY
    STRATEGY --> PARALLEL
    
    NSG_AUTO_FIX --> VALIDATE
    NSG_RESTRICT --> VALIDATE
    NSG_RESOLVE --> VALIDATE
    ASG_UPDATE --> VALIDATE
    ASG_COMPLY --> VALIDATE
    ASG_RECONFIG --> VALIDATE
    PARALLEL --> VALIDATE
    
    VALIDATE -->|Pass| EXECUTE
    VALIDATE -->|Fail| FAILURE
    EXECUTE --> VERIFY
    VERIFY -->|Success| SUCCESS
    VERIFY -->|Failure| ROLLBACK
    ROLLBACK --> FAILURE
    
    classDef start fill:#c8e6c9
    classDef decision fill:#fff3e0
    classDef action fill:#e3f2fd
    classDef end fill:#ffcdd2
    classDef success fill:#c8e6c9
    
    class START start
    class ANALYZE,NSG_TYPE,ASG_TYPE,VALIDATE decision
    class NSG_AUTO_FIX,NSG_RESTRICT,NSG_RESOLVE,ASG_UPDATE,ASG_COMPLY,ASG_RECONFIG,MULTI_AGENT,STRATEGY,PARALLEL,EXECUTE,VERIFY,ROLLBACK action
    class FAILURE end
    class SUCCESS success
```

## API Endpoints Architecture

```mermaid
graph LR
    subgraph "Frontend Requests"
        %% Existing Endpoints
        GET_NSG["GET /api/v1/nsg-rules"]
        GET_ASG["GET /api/v1/reports/asg-validation"]
        POST_EMAIL["POST /api/v1/email/send-report"]
        GET_SCHEDULES["GET /api/v1/email/schedules"]
        POST_SCHEDULE["POST /api/v1/email/schedule"]
        POST_RUN["POST /api/v1/email/schedule/{id}/run"]
        DELETE_SCHEDULE["DELETE /api/v1/email/schedule/{id}"]
        
        %% New AI Remediation Endpoints
        POST_REMEDIATE["POST /api/v1/remediation/start"]
        GET_REM_STATUS["GET /api/v1/remediation/{id}/status"]
        POST_REM_APPROVE["POST /api/v1/remediation/{id}/approve"]
        POST_REM_ROLLBACK["POST /api/v1/remediation/{id}/rollback"]
        GET_AGENTS["GET /api/v1/agents/status"]
        POST_AGENT_CONFIG["POST /api/v1/agents/configure"]
    end

    subgraph "Backend Handlers"
        %% Existing Handlers
        NSG_HANDLER["NSG Rules Handler"]
        ASG_HANDLER["ASG Validation Handler"]
        EMAIL_HANDLER["Email Send Handler"]
        SCHEDULE_HANDLER["Schedule Management"]
        TRIGGER_HANDLER["Manual Trigger Handler"]
        
        %% New AI Handlers
        REMEDIATION_HANDLER["AI Remediation Handler"]
        AGENT_MANAGER["Agent Manager"]
        APPROVAL_HANDLER["Approval Workflow Handler"]
    end

    %% Existing Connections
    GET_NSG --> NSG_HANDLER
    GET_ASG --> ASG_HANDLER
    POST_EMAIL --> EMAIL_HANDLER
    GET_SCHEDULES --> SCHEDULE_HANDLER
    POST_SCHEDULE --> SCHEDULE_HANDLER
    POST_RUN --> TRIGGER_HANDLER
    DELETE_SCHEDULE --> SCHEDULE_HANDLER
    
    %% New AI Connections
    POST_REMEDIATE --> REMEDIATION_HANDLER
    GET_REM_STATUS --> REMEDIATION_HANDLER
    POST_REM_APPROVE --> APPROVAL_HANDLER
    POST_REM_ROLLBACK --> REMEDIATION_HANDLER
    GET_AGENTS --> AGENT_MANAGER
    POST_AGENT_CONFIG --> AGENT_MANAGER

    classDef request fill:#bbdefb
    classDef handler fill:#c8e6c9
    classDef ai_request fill:#fce4ec
    classDef ai_handler fill:#e1f5fe
    
    class GET_NSG,GET_ASG,POST_EMAIL,GET_SCHEDULES,POST_SCHEDULE,POST_RUN,DELETE_SCHEDULE request
    class NSG_HANDLER,ASG_HANDLER,EMAIL_HANDLER,SCHEDULE_HANDLER,TRIGGER_HANDLER handler
    class POST_REMEDIATE,GET_REM_STATUS,POST_REM_APPROVE,POST_REM_ROLLBACK,GET_AGENTS,POST_AGENT_CONFIG ai_request
    class REMEDIATION_HANDLER,AGENT_MANAGER,APPROVAL_HANDLER ai_handler
```

## Email Scheduling System

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Scheduler
    participant E as Email Service
    participant SMTP as SMTP Server

    %% Schedule Creation
    U->>F: Create Email Schedule
    F->>B: POST /api/v1/email/schedule
    B->>S: Store Schedule
    S-->>B: Schedule ID
    B-->>F: Success Response
    F-->>U: Schedule Created

    %% Manual Trigger
    U->>F: Click "Run Now"
    F->>B: POST /api/v1/email/schedule/{id}/run
    B->>S: Get Schedule Details
    S-->>B: Schedule Data
    B->>E: Generate & Send Report
    E->>SMTP: Send Email
    SMTP-->>E: Delivery Status
    E-->>B: Email Result
    B-->>F: Success/Error Response
    F-->>U: Notification

    %% Scheduled Execution (Future)
    Note over S: Automatic Scheduling
    S->>B: Trigger Scheduled Report
    B->>E: Generate & Send Report
    E->>SMTP: Send Email
```

## Data Flow Architecture

```mermaid
flowchart TD
    subgraph "User Actions"
        A1["View Reports"]
        A2["Schedule Email"]
        A3["Run Now"]
        A4["Export Data"]
    end

    subgraph "Frontend Processing"
        F1["React Components"]
        F2["State Management"]
        F3["API Calls"]
    end

    subgraph "Backend Processing"
        B1["Request Routing"]
        B2["Data Validation"]
        B3["Business Logic"]
        B4["Response Generation"]
    end

    subgraph "Data Sources"
        D1["Azure NSG API"]
        D2["Azure ASG API"]
        D3["In-Memory Cache"]
        D4["File System"]
    end

    subgraph "Output"
        O1["JSON Responses"]
        O2["CSV/Excel Files"]
        O3["Email Reports"]
        O4["Log Files"]
    end

    A1 --> F1
    A2 --> F1
    A3 --> F1
    A4 --> F1

    F1 --> F2
    F2 --> F3
    F3 --> B1

    B1 --> B2
    B2 --> B3
    B3 --> B4

    B3 --> D1
    B3 --> D2
    B3 --> D3
    B3 --> D4

    B4 --> O1
    B3 --> O2
    B3 --> O3
    B3 --> O4

    O1 --> F3
    O2 --> A4
    O3 --> A3
```

## Component Hierarchy

```mermaid
graph TD
    subgraph "App.tsx"
        APP["Main App Component"]
    end

    subgraph "Pages"
        RP["ReportsPage.tsx"]
        HP["HomePage.tsx"]
    end

    subgraph "Reports Page Components"
        RT["Reports Table"]
        EM["Email Schedule Modal"]
        ST["Scheduled Reports Table"]
        RB["Run Now Button"]
        EB["Edit Button"]
        DB["Delete Button"]
    end

    subgraph "Shared Components"
        NAV["Navigation"]
        MODAL["Modal Base"]
        BUTTON["Button Components"]
        FORM["Form Components"]
    end

    APP --> RP
    APP --> HP
    APP --> NAV

    RP --> RT
    RP --> EM
    RP --> ST

    ST --> RB
    ST --> EB
    ST --> DB

    EM --> MODAL
    EM --> FORM
    RB --> BUTTON
    EB --> BUTTON
    DB --> BUTTON

    classDef page fill:#e3f2fd
    classDef component fill:#f1f8e9
    classDef shared fill:#fff8e1
    
    class APP,RP,HP page
    class RT,EM,ST,RB,EB,DB component
    class NAV,MODAL,BUTTON,FORM shared
```

## Enhanced Technology Stack with AI Integration

```mermaid
mindmap
  root((NSG Tool with AI))
    Frontend
      React 18
      TypeScript
      Vite
      Tailwind CSS
      Lucide Icons
      Real-time Updates
      Agent Status Dashboard
    Backend
      Python 3.x
      HTTP Server
      JSON Processing
      File I/O
      Logging
      AsyncIO
      WebSocket Support
    AI & Agents
      OpenAI API
        GPT-4 Turbo
        GPT-3.5 Turbo
        Text Embeddings
        Function Calling
      AutoGen Framework
        Multi-Agent System
        Agent Communication
        Task Orchestration
        State Management
      Agent Types
        Coordinator Agent
        NSG Specialist
        ASG Specialist
        Execution Agent
        Review Agent
    External
      Azure REST API
      SMTP Protocol
      Email Services
      OpenAI Services
    Development
      Node.js
      npm
      PowerShell
      Git
      Python Virtual Env
      OpenAI SDK
      AutoGen Library
    Deployment
      Docker
      Docker Compose
      Nginx
      SSL/TLS
      Environment Variables
      API Key Management
    Security
      API Authentication
      Rate Limiting
      Input Validation
      Audit Logging
      Rollback Mechanisms
```

## Implementation Roadmap

```mermaid
gantt
    title AI-Powered Remediation Implementation
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    OpenAI Integration Setup    :p1-1, 2024-01-15, 7d
    AutoGen Framework Setup     :p1-2, after p1-1, 5d
    Basic Agent Architecture    :p1-3, after p1-2, 10d
    
    section Phase 2: Core Agents
    Coordinator Agent          :p2-1, after p1-3, 7d
    NSG Specialist Agent       :p2-2, after p2-1, 10d
    ASG Specialist Agent       :p2-3, after p2-2, 10d
    
    section Phase 3: Execution
    Execution Agent            :p3-1, after p2-3, 8d
    Review & Approval Agent    :p3-2, after p3-1, 6d
    Rollback Mechanisms        :p3-3, after p3-2, 5d
    
    section Phase 4: Integration
    Frontend Dashboard         :p4-1, after p3-3, 12d
    API Endpoints             :p4-2, after p4-1, 8d
    Real-time Updates         :p4-3, after p4-2, 6d
    
    section Phase 5: Testing
    Unit Testing              :p5-1, after p4-3, 10d
    Integration Testing       :p5-2, after p5-1, 8d
    Security Testing          :p5-3, after p5-2, 5d
    
    section Phase 6: Deployment
    Production Setup          :p6-1, after p5-3, 7d
    Monitoring & Logging      :p6-2, after p6-1, 5d
    Documentation            :p6-3, after p6-2, 5d
```